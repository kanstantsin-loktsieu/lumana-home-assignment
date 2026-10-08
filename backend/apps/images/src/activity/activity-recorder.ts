import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { errorMessage } from '@app/common/error-message';
import {
  IMAGES_SOURCE,
  type ActivityEvent,
  type ApiRequestEvent,
  type DomainEventAttributes,
  type DomainEventName,
} from '@app/activity/activity-event';
import { ACTIVITY_CLIENT, ACTIVITY_EVENT_PATTERN } from '@app/activity/activity-transport';
import { ActivitySeriesWriter } from './activity-series-writer';

type ApiRequestFields = Omit<ApiRequestEvent, 'kind' | 'id' | 'source' | 'occurredAt'>;

// callers never await the recorder, so a Redis outage never fails or slows an API call
@Injectable()
export class ActivityRecorder {
  private readonly logger = new Logger(ActivityRecorder.name);

  constructor(
    private readonly writer: ActivitySeriesWriter,
    @Inject(ACTIVITY_CLIENT) private readonly client: ClientProxy,
  ) {}

  recordApiRequest(fields: ApiRequestFields): void {
    this.publish({ kind: 'api-request', ...this.envelope(), ...fields });
  }

  recordDomainEvent(
    name: DomainEventName,
    value: number,
    attributes: DomainEventAttributes = {},
  ): void {
    this.publish({ kind: 'domain-event', ...this.envelope(), name, value, attributes });
  }

  private envelope(): Pick<ActivityEvent, 'id' | 'source' | 'occurredAt'> {
    return { id: randomUUID(), source: IMAGES_SOURCE, occurredAt: new Date().toISOString() };
  }

  private publish(event: ActivityEvent): void {
    const type = event.kind === 'api-request' ? `${event.method} ${event.route}` : event.name;
    void Promise.allSettled([
      this.writer.write(event),
      lastValueFrom(this.client.emit(ACTIVITY_EVENT_PATTERN, event), { defaultValue: undefined }),
    ]).then(([series, transport]) => {
      if (series.status === 'rejected') {
        this.logger.warn(`Time series write failed for ${type}: ${errorMessage(series.reason)}`);
      }
      if (transport.status === 'rejected') {
        this.logger.warn(
          `Publishing to the logs service failed for ${type}: ${errorMessage(transport.reason)}`,
        );
      }
    });
  }
}
