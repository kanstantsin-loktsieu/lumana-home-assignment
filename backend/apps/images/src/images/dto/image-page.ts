import { ApiProperty } from '@nestjs/swagger';
import { CursorPageDto } from '@app/http/cursor-page';

export class ImageDto {
  @ApiProperty({ example: 'as11-40-5874' })
  readonly nasaId: string;

  @ApiProperty()
  readonly title: string;

  @ApiProperty({ type: String, nullable: true })
  readonly description: string | null;

  @ApiProperty({ format: 'date-time' })
  readonly dateCreated: string;

  @ApiProperty({ type: String, nullable: true, example: 'JSC' })
  readonly center: string | null;

  @ApiProperty({ type: [String] })
  readonly keywords: readonly string[];

  @ApiProperty({ type: String, nullable: true })
  readonly photographer: string | null;

  @ApiProperty({ type: String, nullable: true })
  readonly thumbUrl: string | null;

  @ApiProperty({ type: String, nullable: true })
  readonly imageUrl: string | null;
}

export class ImagePageDto extends CursorPageDto {
  @ApiProperty({ type: [ImageDto] })
  readonly items: readonly ImageDto[];
}
