import type { ActivityEvent, ApiOutcome, DomainEventName } from '@app/activity/activity-event';
import type { LogDocument, LogLevel } from '../models/log-document';

const LEVEL_BY_OUTCOME: Readonly<Record<ApiOutcome, LogLevel>> = {
  success: 'info',
  'client-error': 'warn',
  'server-error': 'error',
};

const domainLevel = (name: DomainEventName): LogLevel =>
  name.endsWith('.failed') ? 'error' : name === 'images.records.rejected' ? 'warn' : 'info';

export const toLogDocument = (event: ActivityEvent, receivedAt: Date): LogDocument => {
  const common = {
    _id: event.id,
    source: event.source,
    kind: event.kind,
    occurredAt: new Date(event.occurredAt),
    receivedAt,
  };
  return event.kind === 'api-request'
    ? {
        ...common,
        type: `${event.method} ${event.route}`,
        level: LEVEL_BY_OUTCOME[event.outcome],
        method: event.method,
        route: event.route,
        statusCode: event.statusCode,
        durationMs: event.durationMs,
        outcome: event.outcome,
      }
    : {
        ...common,
        type: event.name,
        level: domainLevel(event.name),
        value: event.value,
        attributes: event.attributes,
      };
};
