import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize, of, shareReplay, tap } from 'rxjs';
import { HttpCache } from '../services/http-cache';

// matches the NASA API's `Cache-Control: max-age=300`.
const CACHE_TTL_MS = 300000;

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
