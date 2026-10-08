import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ACTIVITY_EVENT_KINDS,
  API_OUTCOMES,
  type ActivityEventKind,
  type ApiOutcome,
  type DomainEventAttributes,
} from '@app/activity/activity-event';
import { CursorPageDto } from '@app/http/cursor-page';
import { LOG_LEVELS, type LogLevel } from '../models/log-document';

export class LogDto {
  @ApiProperty({ description: 'Event id' })
  readonly id: string;

  @ApiProperty({ example: 'images' })
  readonly source: string;

  @ApiProperty({ enum: ACTIVITY_EVENT_KINDS })
  readonly kind: ActivityEventKind;

  @ApiProperty({ example: 'POST /images/import' })
  readonly type: string;

  @ApiProperty({ enum: LOG_LEVELS })
  readonly level: LogLevel;

  @ApiProperty({ format: 'date-time' })
  readonly occurredAt: string;

  @ApiProperty({ format: 'date-time' })
  readonly receivedAt: string;

  @ApiPropertyOptional()
  readonly method?: string;

  @ApiPropertyOptional({ example: '/images/import' })
  readonly route?: string;

  @ApiPropertyOptional()
  readonly statusCode?: number;

  @ApiPropertyOptional()
  readonly durationMs?: number;

  @ApiPropertyOptional({ enum: API_OUTCOMES })
  readonly outcome?: ApiOutcome;

  @ApiPropertyOptional({ description: 'Domain events: the measured value, e.g. records upserted' })
  readonly value?: number;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  readonly attributes?: DomainEventAttributes;
}

export class LogPageDto extends CursorPageDto {
  @ApiProperty({ type: [LogDto] })
  readonly items: readonly LogDto[];
}
