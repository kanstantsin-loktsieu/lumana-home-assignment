import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import type { ApiOutcome } from '@app/activity/activity-event';
import { isRecord } from '@app/common/type-guards';
import { ActivityRecorder } from './activity-recorder';

// nginx's "client closed request": the client left before the response was sent
const CLIENT_CLOSED_REQUEST = 499;

const outcomeOf = (statusCode: number): ApiOutcome =>
  statusCode >= 500 ? 'server-error' : statusCode >= 400 ? 'client-error' : 'success';

const routeOf = (request: Request): string => {
  const route: unknown = request.route;
  return isRecord(route) && typeof route['path'] === 'string' ? route['path'] : 'unmatched';
};

// waits for the response `close` event, so the status code is final even for errors mapped by
// exception filters and for streamed bodies
@Injectable()
export class ActivityInterceptor implements NestInterceptor {
  constructor(private readonly recorder: ActivityRecorder) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const startedAt = performance.now();
    response.once('close', () => {
      const statusCode = response.writableFinished ? response.statusCode : CLIENT_CLOSED_REQUEST;
      this.recorder.recordApiRequest({
        method: request.method,
        route: routeOf(request),
        statusCode,
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
        outcome: outcomeOf(statusCode),
      });
    });
    return next.handle();
  }
}
