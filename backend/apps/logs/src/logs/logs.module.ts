import { Module } from '@nestjs/common';
import { ActivityEventsController } from './activity-events.controller';
import { LogsController } from './logs.controller';
import { LogsRepository } from './logs-repository';

@Module({
  controllers: [LogsController, ActivityEventsController],
  providers: [LogsRepository],
})
export class LogsModule {}
