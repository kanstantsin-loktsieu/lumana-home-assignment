import { Inject, Injectable } from '@nestjs/common';
import type { TimeSeriesAggregationType, TimeSeriesReducer } from 'redis';
import { IMAGES_SOURCE } from '@app/activity/activity-event';
import { seriesFilter, type SeriesLabel, type SeriesMetric } from '@app/activity/activity-series';
import { isRecord } from '@app/common/type-guards';
import { REDIS_CLIENT, type RedisClient } from '@app/redis/redis-client';
import type { ActivitySeriesSet, Point, Series } from './models/activity-report-rpc';

interface GroupedRange {
  readonly metric: SeriesMetric;
  readonly aggregation: TimeSeriesAggregationType;
  readonly groupBy: SeriesLabel;
  readonly reducer: TimeSeriesReducer;
}

// group keys come back as `"<label>=<value>"`, e.g. `"route=GET /images"`
const groupValue = (key: string, label: SeriesLabel): string =>
  key.startsWith(`${label}=`) ? key.slice(label.length + 1) : key;

const toPoints = (group: unknown): Point[] => {
  const samples = isRecord(group) ? group['samples'] : null;
  return (Array.isArray(samples) ? samples : [])
    .filter(isRecord)
    .map((sample) => ({ timestampMs: Number(sample['timestamp']), value: Number(sample['value']) }))
    .filter((point) => Number.isFinite(point.timestampMs) && Number.isFinite(point.value));
};

// depending on the client's type mapping the reply is a `Map` or a plain object
const toSeries = (reply: unknown, label: SeriesLabel): Series[] => {
  const entries: [unknown, unknown][] =
    reply instanceof Map ? [...reply.entries()] : isRecord(reply) ? Object.entries(reply) : [];
  return entries
    .map(([key, group]) => ({
      label: groupValue(String(key), label),
      points: toPoints(group),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
};

@Injectable()
export class ActivitySeriesReader {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {}

  async read(fromMs: number, toMs: number, bucketMs: number): Promise<ActivitySeriesSet> {
    const range = (query: GroupedRange) => this.groupedRange(query, fromMs, toMs, bucketMs);
    const [requestsByRoute, requestsByOutcome, avgLatencyByRoute, maxLatencyByRoute, domainEvents] =
      await Promise.all([
        range({ metric: 'api_requests', aggregation: 'SUM', groupBy: 'route', reducer: 'SUM' }),
        range({ metric: 'api_requests', aggregation: 'SUM', groupBy: 'outcome', reducer: 'SUM' }),
        // one latency series per route, so the reducer only passes it through
        range({ metric: 'api_latency_ms', aggregation: 'AVG', groupBy: 'route', reducer: 'MAX' }),
        range({ metric: 'api_latency_ms', aggregation: 'MAX', groupBy: 'route', reducer: 'MAX' }),
        range({ metric: 'domain_events', aggregation: 'SUM', groupBy: 'name', reducer: 'SUM' }),
      ]);
    return {
      requestsByRoute,
      requestsByOutcome,
      avgLatencyByRoute,
      maxLatencyByRoute,
      domainEventsByName: domainEvents,
    };
  }

  private async groupedRange(
    { metric, aggregation, groupBy, reducer }: GroupedRange,
    fromMs: number,
    toMs: number,
    bucketMs: number,
  ): Promise<Series[]> {
    const reply = await this.redis.ts.mRangeGroupBy(
      fromMs,
      toMs,
      seriesFilter(IMAGES_SOURCE, metric),
      { label: groupBy, REDUCE: reducer },
      { ALIGN: fromMs, AGGREGATION: { type: aggregation, timeBucket: bucketMs } },
    );
    return toSeries(reply, groupBy);
  }
}
