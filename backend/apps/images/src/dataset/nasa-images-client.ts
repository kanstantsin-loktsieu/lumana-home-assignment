import { setTimeout as sleep } from 'node:timers/promises';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { errorMessage } from '@app/common/error-message';
import { isRecord } from '@app/common/type-guards';
import type { ImageRecord } from '../shared/models/image-record';
import type { Environment } from '../config/environment';
import type { NasaSearchResponseDto } from './models/nasa-images-dto';
import { toImageRecords } from './utils/nasa-images-mapper';

export type NasaPageResult =
  | { readonly kind: 'page'; readonly records: readonly ImageRecord[]; readonly totalHits: number }
  | { readonly kind: 'result-cap' };

export class NasaRequestError extends Error {
  constructor(
    readonly kind: 'http' | 'network' | 'timeout',
    readonly status: number | null,
    message: string,
    readonly retryable: boolean,
    readonly retryAfterMs: number | null = null,
  ) {
    super(message);
  }
}

// retry policy mirrors the frontend retry interceptor: 2 retries, 400 ms exponential base
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 400;
const RETRY_AFTER_CAP_MS = 10_000;
const REQUEST_TIMEOUT_MS = 15_000;
const TRANSIENT_STATUSES: ReadonlySet<number> = new Set([429, 502, 503, 504]);
// the NASA API answers 400 with this reason once `page * page_size` passes 10,000 results
const RESULT_CAP_REASON = 'Maximum number of search results';

const isSearchResponse = (body: unknown): body is NasaSearchResponseDto => {
  const collection = isRecord(body) ? body['collection'] : null;
  if (!isRecord(collection)) return false;
  const { items, metadata } = collection;
  return (
    Array.isArray(items) &&
    items.every((item) => isRecord(item) && Array.isArray(item['data'])) &&
    isRecord(metadata) &&
    typeof metadata['total_hits'] === 'number'
  );
};

const isResultCapBody = (body: unknown): boolean =>
  isRecord(body) &&
  typeof body['reason'] === 'string' &&
  body['reason'].includes(RESULT_CAP_REASON);

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const retryAfterMs = (header: string | null): number | null => {
  const seconds = header === null ? NaN : Number(header);
  return Number.isFinite(seconds) && seconds >= 0
    ? Math.min(seconds * 1000, RETRY_AFTER_CAP_MS)
    : null;
};

const transportError = (error: unknown, status: number | null): NasaRequestError => {
  const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
  return new NasaRequestError(timedOut ? 'timeout' : 'network', status, errorMessage(error), true);
};

@Injectable()
export class NasaImagesClient {
  private readonly baseUrl: string;
  private readonly pageSize: number;

  constructor(config: ConfigService<Environment, true>) {
    this.baseUrl = config.get('NASA_API_URL', { infer: true });
    this.pageSize = config.get('NASA_PAGE_SIZE', { infer: true });
  }

  // aborting `signal` rejects with the abort reason, never a `NasaRequestError`, so callers can
  // tell a stop from a failure
  async fetchPage(query: string, page: number, signal: AbortSignal): Promise<NasaPageResult> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.request(query, page, signal);
      } catch (error) {
        if (signal.aborted || !(error instanceof NasaRequestError)) throw error;
        if (!error.retryable || attempt > MAX_RETRIES) throw error;
        await sleep(error.retryAfterMs ?? RETRY_BASE_MS * 2 ** (attempt - 1), undefined, {
          signal,
        });
      }
    }
  }

  private async request(query: string, page: number, signal: AbortSignal): Promise<NasaPageResult> {
    const url = new URL('/search', this.baseUrl);
    url.searchParams.set('q', query);
    url.searchParams.set('media_type', 'image');
    url.searchParams.set('page', String(page));
    url.searchParams.set('page_size', String(this.pageSize));

    let response: Response;
    let text: string;
    try {
      response = await fetch(url, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
      });
    } catch (error) {
      if (signal.aborted) throw error;
      throw transportError(error, null);
    }
    try {
      text = await response.text();
    } catch (error) {
      if (signal.aborted) throw error;
      throw transportError(error, response.status);
    }
    const body = parseJson(text);

    if (response.ok) {
      // a 200 with an unreadable or unexpected body is most likely truncated, so it is retried
      if (!isSearchResponse(body)) {
        throw new NasaRequestError(
          'http',
          response.status,
          `NASA API sent an unexpected body for "${query}" page ${page}`,
          true,
        );
      }
      return {
        kind: 'page',
        records: toImageRecords(body),
        totalHits: body.collection.metadata.total_hits,
      };
    }
    if (response.status === 400 && isResultCapBody(body)) return { kind: 'result-cap' };
    throw new NasaRequestError(
      'http',
      response.status,
      `NASA API responded ${response.status} for "${query}" page ${page}`,
      TRANSIENT_STATUSES.has(response.status),
      retryAfterMs(response.headers.get('retry-after')),
    );
  }
}
