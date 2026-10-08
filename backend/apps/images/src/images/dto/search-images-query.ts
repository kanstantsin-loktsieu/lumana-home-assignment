import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { CursorPageQueryDto } from '@app/http/cursor-page';

export class SearchImagesQueryDto extends CursorPageQueryDto {
  @ApiPropertyOptional({
    description: 'Full-text search over title, keywords and description',
    example: 'apollo 11',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  readonly q?: string;

  @ApiPropertyOptional({ description: 'NASA center, exact match', example: 'JSC' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  readonly center?: string;

  @ApiPropertyOptional({ description: 'Keyword, exact match', example: 'Moon' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  readonly keyword?: string;

  @ApiPropertyOptional({ description: 'dateCreated from (inclusive), ISO 8601' })
  @IsOptional()
  @IsISO8601()
  readonly from?: string;

  @ApiPropertyOptional({ description: 'dateCreated to (exclusive), ISO 8601' })
  @IsOptional()
  @IsISO8601()
  readonly to?: string;
}
