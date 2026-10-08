import { ApiProperty } from '@nestjs/swagger';
import { ACTIVITY_EVENT_KINDS, type ActivityEventKind } from '@app/activity/activity-event';

export class LogTypeCountDto {
  @ApiProperty({ example: 'GET /images' })
  readonly type: string;

  @ApiProperty({ enum: ACTIVITY_EVENT_KINDS })
  readonly kind: ActivityEventKind;

  @ApiProperty()
  readonly count: number;
}
