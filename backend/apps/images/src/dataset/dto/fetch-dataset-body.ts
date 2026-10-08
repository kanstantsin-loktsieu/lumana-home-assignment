import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class FetchDatasetBodyDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'Search queries, fetched in order. Defaults to NASA_FETCH_QUERIES.',
    example: ['apollo', 'mars'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Length(2, 50, { each: true })
  readonly queries?: string[];

  @ApiPropertyOptional({
    minimum: 100,
    maximum: 100_000,
    description: 'Stop after this many unique records. Defaults to NASA_FETCH_TARGET.',
    example: 500,
  })
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(100_000)
  readonly target?: number;
}
