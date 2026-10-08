export const IMAGES_SOURCE = 'images';

export const ACTIVITY_SOURCES = [IMAGES_SOURCE] as const;

export type ActivitySource = (typeof ACTIVITY_SOURCES)[number];

export const ACTIVITY_EVENT_KINDS = ['api-request', 'domain-event'] as const;

export type ActivityEventKind = (typeof ACTIVITY_EVENT_KINDS)[number];

export const API_OUTCOMES = ['success', 'client-error', 'server-error'] as const;

export type ApiOutcome = (typeof API_OUTCOMES)[number];

export const DOMAIN_EVENT_NAMES = [
  'dataset.page.fetched',
  'dataset.fetch.completed',
  'dataset.fetch.failed',
  'images.batch.upserted',
  'images.records.rejected',
  'images.import.completed',
  'images.import.failed',
] as const;

export type DomainEventName = (typeof DOMAIN_EVENT_NAMES)[number];

export type DomainEventAttributes = Readonly<Record<string, string | number | boolean>>;

export interface ApiRequestEvent {
  readonly kind: 'api-request';
  readonly id: string;
  readonly source: ActivitySource;
  readonly occurredAt: string;
  readonly method: string;
  // route template such as `/images`, never the raw URL, so series cardinality stays bounded
  readonly route: string;
  readonly statusCode: number;
  readonly durationMs: number;
  readonly outcome: ApiOutcome;
}

export interface DomainEvent {
  readonly kind: 'domain-event';
  readonly id: string;
  readonly source: ActivitySource;
  readonly occurredAt: string;
  readonly name: DomainEventName;
  readonly value: number;
  readonly attributes: DomainEventAttributes;
}

export type ActivityEvent = ApiRequestEvent | DomainEvent;
