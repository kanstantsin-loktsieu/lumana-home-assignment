import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { ACTIVITY_EVENT_KINDS, type ActivityEventKind } from '@app/activity/activity-event';
import { CursorPageQueryDto } from '@app/http/cursor-page';
import { LOG_LEVELS, type LogLevel } from '../models/log-document';

export class QueryLogsDto extends CursorPageQueryDto {
  @ApiPropertyOptional({
    description: 'occurredAt from (inclusive); a date or a date-time with a zone',
  })
  @IsOptional()
  @IsISO8601()
  readonly from?: string;

  @ApiPropertyOptional({
    description: 'occurredAt to (exclusive); a date or a date-time with a zone',
  })
  @IsOptional()
  @IsISO8601()
  readonly to?: string;

  @ApiPropertyOptional({ enum: ACTIVITY_EVENT_KINDS })
  @IsOptional()
  @IsIn(ACTIVITY_EVENT_KINDS)
  readonly kind?: ActivityEventKind;

  @ApiPropertyOptional({
    description: '"<METHOD> <route>" or a domain event name; see GET /logs/types',
    example: 'GET /images',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  readonly type?: string;

  @ApiPropertyOptional({ enum: LOG_LEVELS })
  @IsOptional()
  @IsIn(LOG_LEVELS)
  readonly level?: LogLevel;
}
