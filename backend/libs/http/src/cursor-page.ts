import { BadRequestException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { decodeCursor, type KeysetCursor } from '@app/mongo/keyset-cursor';

export const KEYSET_PAGINATION_DESCRIPTION =
  'Newest first, keyset-paginated: pass `nextCursor` back as `cursor`.';

export class CursorPageQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit: number = 20;

  @ApiPropertyOptional({ description: 'Opaque `nextCursor` from the previous page' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  readonly cursor?: string;
}

export abstract class CursorPageDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Pass as `cursor` to get the next page; null on the last page',
  })
  readonly nextCursor: string | null;
}

export const parseCursor = (text: string | undefined): KeysetCursor | null => {
  if (text === undefined) return null;
  const cursor = decodeCursor(text);
  if (cursor === null) throw new BadRequestException('Invalid cursor');
  return cursor;
};
