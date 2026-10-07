import { HttpEvent, HttpResponse } from '@angular/common/http';
import { Service } from '@angular/core';
import { Observable } from 'rxjs';
import { LruCache } from '../../shared/utils/lru-cache';
import { CachedResponse } from './models/cached-response';

const HTTP_CACHE_MAX_ENTRIES = 100;

/**
 * Response cache and registry of shared in-flight requests used by `httpCacheInterceptor`.
 * Both stores are private; callers go through the methods, so expiry is handled in one place.
 */
@Service()
export class HttpCache {
  private readonly responses = new LruCache<string, CachedResponse>(HTTP_CACHE_MAX_ENTRIES);
  private readonly pendingRequests = new Map<string, Observable<HttpEvent<unknown>>>();

  /** A clone of the cached response for `key`, or `null` if there is none or it has expired. */
  getResponse(key: string): HttpResponse<unknown> | null {
    const cached = this.responses.get(key);
    if (!cached) {
      return null;
    }
    if (cached.expiresAt <= Date.now()) {
      this.responses.delete(key);
      return null;
    }
    return cached.response.clone();
  }

  setResponse(key: string, response: HttpResponse<unknown>, ttlMs: number): void {
    this.responses.set(key, { response, expiresAt: Date.now() + ttlMs });
  }

  getPendingRequest(key: string): Observable<HttpEvent<unknown>> | null {
    return this.pendingRequests.get(key) ?? null;
  }

  setPendingRequest(key: string, request$: Observable<HttpEvent<unknown>>): void {
    this.pendingRequests.set(key, request$);
  }

  deletePendingRequest(key: string): void {
    this.pendingRequests.delete(key);
  }
}
