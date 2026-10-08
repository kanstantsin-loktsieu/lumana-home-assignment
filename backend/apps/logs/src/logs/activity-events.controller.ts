import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { errorMessage } from '@app/common/error-message';
import { ACTIVITY_EVENT_PATTERN } from '@app/activity/activity-transport';
import { isActivityEvent } from '@app/activity/is-activity-event';
import { LogsRepository } from './logs-repository';
import { toLogDocument } from './utils/to-log-document';

// pub/sub on Redis delivers at most once, so there is no ack or retry here
@Controller()
export class ActivityEventsController {
  private readonly logger = new Logger(ActivityEventsController.name);

  constructor(private readonly repository: LogsRepository) {}

  @EventPattern(ACTIVITY_EVENT_PATTERN)
  async store(@Payload() payload: unknown): Promise<void> {
    if (!isActivityEvent(payload)) {
      this.logger.warn('Dropped a malformed activity event');
      return;
    }
    try {
      await this.repository.insert(toLogDocument(payload, new Date()));
    } catch (error) {
      this.logger.error(`Storing event ${payload.id} failed: ${errorMessage(error)}`);
    }
  }
}
