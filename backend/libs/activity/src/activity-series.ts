import type { TimeSeriesDuplicatePolicies } from 'redis';
import type { ActivitySource, ApiRequestEvent, DomainEvent } from './activity-event';

export const ACTIVITY_RETENTION_DAYS = 30;

export const ACTIVITY_RETENTION_MS = ACTIVITY_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export type SeriesLabel = 'source' | 'metric' | 'route' | 'outcome' | 'name';

export type SeriesMetric = 'api_requests' | 'api_latency_ms' | 'domain_events';

export interface SeriesSample {
  readonly key: string;
  readonly timestamp: number;
  readonly value: number;
  readonly labels: Readonly<Partial<Record<SeriesLabel, string>>>;
  readonly onDuplicate: TimeSeriesDuplicatePolicies;
}

// series are created lazily by `TS.ADD ... LABELS`, so there is no setup step
export const apiRequestSeries = (event: ApiRequestEvent): readonly SeriesSample[] => {
  const route = `${event.method} ${event.route}`;
  const timestamp = Date.parse(event.occurredAt);
  return [
    {
      key: `activity:api:requests:${route}:${event.outcome}`,
      timestamp,
      value: 1,
      labels: { source: event.source, metric: 'api_requests', route, outcome: event.outcome },
      onDuplicate: 'SUM',
    },
    {
      key: `activity:api:latency:${route}`,
      timestamp,
      value: event.durationMs,
      labels: { source: event.source, metric: 'api_latency_ms', route },
      onDuplicate: 'MAX',
    },
  ];
};

export const domainEventSeries = (event: DomainEvent): readonly SeriesSample[] => [
  {
    key: `activity:domain:${event.name}`,
    timestamp: Date.parse(event.occurredAt),
    value: event.value,
    labels: { source: event.source, metric: 'domain_events', name: event.name },
    onDuplicate: 'SUM',
  },
];

export const seriesFilter = (source: ActivitySource, metric: SeriesMetric): string[] => [
  `source=${source}`,
  `metric=${metric}`,
];
