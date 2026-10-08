import type {
  ActivityEventKind,
  ActivitySource,
  ApiOutcome,
  DomainEventAttributes,
} from '@app/activity/activity-event';

export const LOG_LEVELS = ['info', 'warn', 'error'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

// `_id` is the event id, so a redelivered event is stored once
export interface LogDocument {
  readonly _id: string;
  readonly source: ActivitySource;
  readonly kind: ActivityEventKind;
  readonly type: string;
  readonly level: LogLevel;
  readonly occurredAt: Date;
  readonly receivedAt: Date;
  readonly method?: string;
  readonly route?: string;
  readonly statusCode?: number;
  readonly durationMs?: number;
  readonly outcome?: ApiOutcome;
  readonly value?: number;
  readonly attributes?: DomainEventAttributes;
}
