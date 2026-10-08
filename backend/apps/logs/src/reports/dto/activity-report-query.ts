import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

export class ActivityReportQueryDto {
  @ApiPropertyOptional({ description: 'Range start, ISO 8601. Defaults to 24 hours before `to`.' })
  @IsOptional()
  @IsISO8601()
  readonly from?: string;

  @ApiPropertyOptional({ description: 'Range end, ISO 8601. Defaults to now.' })
  @IsOptional()
  @IsISO8601()
  readonly to?: string;
}
