import { Inject, Injectable } from '@nestjs/common';
import type { ActivityEvent } from '@app/activity/activity-event';
import {
  ACTIVITY_RETENTION_MS,
  apiRequestSeries,
  domainEventSeries,
} from '@app/activity/activity-series';
import { REDIS_CLIENT, type RedisClient } from '@app/redis/redis-client';

@Injectable()
export class ActivitySeriesWriter {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {}

  async write(event: ActivityEvent): Promise<void> {
    const samples =
      event.kind === 'api-request' ? apiRequestSeries(event) : domainEventSeries(event);
    const transaction = this.redis.multi();
    for (const sample of samples) {
      transaction.ts.add(sample.key, sample.timestamp, sample.value, {
        RETENTION: ACTIVITY_RETENTION_MS,
        ON_DUPLICATE: sample.onDuplicate,
        LABELS: sample.labels,
      });
    }
    await transaction.exec();
  }
}
