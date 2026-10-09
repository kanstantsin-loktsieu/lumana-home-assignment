import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

export class ActivityReportQueryDto {
  @ApiPropertyOptional({
    description:
      'Range start; a date or a date-time with a zone. Defaults to 24 hours before `to`.',
  })
  @IsOptional()
  @IsISO8601()
  readonly from?: string;

  @ApiPropertyOptional({
    description: 'Range end; a date or a date-time with a zone. Defaults to now.',
  })
  @IsOptional()
  @IsISO8601()
  readonly to?: string;
}
