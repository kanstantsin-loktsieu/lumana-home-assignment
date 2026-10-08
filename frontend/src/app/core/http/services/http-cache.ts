import { HttpEvent, HttpResponse } from '@angular/common/http';
import { Service } from '@angular/core';
import { Observable } from 'rxjs';
import { CachedResponse } from '../models/cached-response';
import { LruCache } from '../utils/lru-cache';

@Service()
export class HttpCache {
  private readonly maxEntries = 100;
  private readonly responses = new LruCache<string, CachedResponse>(this.maxEntries);
  private readonly pendingRequests = new Map<string, Observable<HttpEvent<unknown>>>();

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
