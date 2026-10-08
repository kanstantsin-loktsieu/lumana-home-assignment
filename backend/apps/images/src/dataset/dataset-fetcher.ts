import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { errorMessage } from '@app/common/error-message';
import { ActivityRecorder } from '../activity/activity-recorder';
import type { Environment } from '../config/environment';
import type { ImageRecord } from '../shared/models/image-record';
import { DatasetFiles, type DatasetWriter } from './dataset-files';
import type { FetchSummaryDto, QueryFetchSummaryDto } from './dto/fetch-summary';
import { NasaImagesClient, NasaRequestError } from './nasa-images-client';
import { mapWithConcurrency } from './utils/map-with-concurrency';

export interface FetchOptions {
  readonly queries?: readonly string[];
  readonly target?: number;
}

// the NASA API serves at most 10,000 results per query (`page * page_size <= 10000`)
const MAX_REACHABLE_RESULTS = 10_000;

interface FetchRun {
  readonly target: number;
  readonly seen: Set<string>;
  readonly writer: DatasetWriter;
  readonly stop: AbortController;
}

type QueryProgress = { -readonly [K in keyof QueryFetchSummaryDto]: QueryFetchSummaryDto[K] };

@Injectable()
export class DatasetFetcher {
  private readonly logger = new Logger(DatasetFetcher.name);
  private readonly defaultQueries: readonly string[];
  private readonly defaultTarget: number;
  private readonly pageSize: number;
  private readonly concurrency: number;
  private running = false;

  constructor(
    config: ConfigService<Environment, true>,
    private readonly client: NasaImagesClient,
    private readonly files: DatasetFiles,
    private readonly recorder: ActivityRecorder,
  ) {
    this.defaultQueries = config.get('NASA_FETCH_QUERIES', { infer: true });
    this.defaultTarget = config.get('NASA_FETCH_TARGET', { infer: true });
    this.pageSize = config.get('NASA_PAGE_SIZE', { infer: true });
    this.concurrency = config.get('NASA_FETCH_CONCURRENCY', { infer: true });
  }

  async run(options: FetchOptions): Promise<FetchSummaryDto> {
    if (this.running) throw new ConflictException('A dataset fetch is already running');
    this.running = true;
    try {
      return await this.fetchAll(
        options.queries ?? this.defaultQueries,
        options.target ?? this.defaultTarget,
      );
    } finally {
      this.running = false;
    }
  }

  private async fetchAll(queries: readonly string[], target: number): Promise<FetchSummaryDto> {
    const startedAt = performance.now();
    const run: FetchRun = {
      target,
      seen: new Set(),
      writer: await this.files.open(),
      stop: new AbortController(),
    };
    try {
      const summaries: QueryFetchSummaryDto[] = [];
      for (const query of queries) {
        if (run.stop.signal.aborted) break;
        summaries.push(await this.fetchQuery(query, run));
      }
      const files = await run.writer.commit();
      const durationMs = Math.round(performance.now() - startedAt);
      this.recorder.recordDomainEvent('dataset.fetch.completed', run.seen.size, {
        queries: summaries.length,
        durationMs,
      });
      return {
        records: run.seen.size,
        stoppedBy: run.seen.size >= target ? 'target-reached' : 'queries-exhausted',
        durationMs,
        queries: summaries,
        files,
      };
    } catch (error) {
      run.stop.abort();
      await run.writer.abort();
      this.recorder.recordDomainEvent('dataset.fetch.failed', run.seen.size, {
        reason: errorMessage(error),
      });
      throw error;
    }
  }

  private async fetchQuery(query: string, run: FetchRun): Promise<QueryFetchSummaryDto> {
    const progress: QueryProgress = {
      query,
      totalHits: 0,
      pagesFetched: 0,
      pagesFailed: 0,
      newRecords: 0,
    };
    // aborted on the result-cap answer, which ends this query but not the run
    const queryStop = new AbortController();
    const signal = AbortSignal.any([run.stop.signal, queryStop.signal]);

    const first = await this.fetchPage(query, 1, signal, progress, run);
    if (first === null || first.kind === 'result-cap') return progress;
    progress.totalHits = first.totalHits;

    const lastPage = Math.min(
      Math.ceil(first.totalHits / this.pageSize),
      Math.floor(MAX_REACHABLE_RESULTS / this.pageSize),
    );
    const pages = Array.from({ length: Math.max(lastPage - 1, 0) }, (_, index) => index + 2);
    await mapWithConcurrency(
      pages,
      this.concurrency,
      async (page) => {
        const result = await this.fetchPage(query, page, signal, progress, run);
        if (result?.kind === 'result-cap') queryStop.abort();
      },
      signal,
    );
    return progress;
  }

  private async fetchPage(
    query: string,
    page: number,
    signal: AbortSignal,
    progress: QueryProgress,
    run: FetchRun,
  ) {
    try {
      const result = await this.client.fetchPage(query, page, signal);
      if (result.kind === 'page') {
        progress.pagesFetched++;
        const added = await this.accept(result.records, run);
        progress.newRecords += added;
        this.recorder.recordDomainEvent('dataset.page.fetched', added, { query, page });
      }
      return result;
    } catch (error) {
      if (signal.aborted) return null;
      if (!(error instanceof NasaRequestError)) throw error;
      progress.pagesFailed++;
      const status = error.status === null ? '' : ` ${error.status}`;
      this.logger.warn(
        `Skipping "${query}" page ${page} (${error.kind}${status}): ${error.message}`,
      );
      return null;
    }
  }

  private async accept(records: readonly ImageRecord[], run: FetchRun): Promise<number> {
    let added = 0;
    for (const record of records) {
      if (run.seen.size >= run.target) break;
      if (run.seen.has(record.nasaId)) continue;
      run.seen.add(record.nasaId);
      added++;
      await run.writer.write(record);
    }
    if (run.seen.size >= run.target) run.stop.abort();
    return added;
  }
}
