import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize, of, shareReplay, tap } from 'rxjs';
import { HttpCache } from './http-cache';

const MS_PER_SECOND = 1000;
const API_MAX_AGE_SECONDS = 300;
/** Matches the NASA API's `Cache-Control: max-age=300`. */
const CACHE_TTL_MS = API_MAX_AGE_SECONDS * MS_PER_SECOND;

/**
 * Caches successful GET responses in memory (TTL + LRU) and shares identical in-flight requests.
 *
 * `shareReplay({ refCount: true })` keeps cancellation real: when the last subscriber unsubscribes
 * (e.g. a `switchMap` moved on), the underlying fetch is aborted and nothing is cached.
 */
export const httpCacheInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET') {
    return next(req);
  }

  const cache = inject(HttpCache);
  const key = req.urlWithParams;

  const cachedResponse = cache.getResponse(key);
  if (cachedResponse) {
    return of(cachedResponse);
  }

  const pendingRequest = cache.getPendingRequest(key);
  if (pendingRequest) {
    return pendingRequest;
  }

  const sharedRequest$ = next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse && event.ok) {
        cache.setResponse(key, event, CACHE_TTL_MS);
      }
    }),
    finalize(() => cache.deletePendingRequest(key)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
  cache.setPendingRequest(key, sharedRequest$);
  return sharedRequest$;
};
