import { HttpErrorResponse, HttpInterceptorFn, HttpStatusCode } from '@angular/common/http';
import { retry, throwError, timer } from 'rxjs';
import { NETWORK_ERROR_STATUS } from '../../shared/constants/http.constants';

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 400;
const TRANSIENT_STATUSES = new Set<number>([
  NETWORK_ERROR_STATUS,
  HttpStatusCode.TooManyRequests,
  HttpStatusCode.BadGateway,
  HttpStatusCode.ServiceUnavailable,
  HttpStatusCode.GatewayTimeout,
]);

const isTransient = (error: unknown): boolean =>
  error instanceof HttpErrorResponse && TRANSIENT_STATUSES.has(error.status);

/**
 * Retries idempotent GETs on transient failures with exponential backoff (400 ms, 800 ms).
 * The delay is a `timer`, so an unsubscribing caller (e.g. `switchMap`) cancels pending retries.
 */
export const retryInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET') {
    return next(req);
  }
  return next(req).pipe(
    retry({
      count: MAX_RETRIES,
      delay: (error: unknown, retryCount: number) =>
        isTransient(error) ? timer(BASE_DELAY_MS * 2 ** (retryCount - 1)) : throwError(() => error),
    }),
  );
};
