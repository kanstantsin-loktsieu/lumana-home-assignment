import { HttpErrorResponse, HttpInterceptorFn, HttpStatusCode } from '@angular/common/http';
import { retry, throwError, timer } from 'rxjs';
import { NETWORK_ERROR_STATUS } from '../../../shared/constants/error-status';

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

export const retryInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET') {
    // only care about idempotent GETs
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
