import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DATASET_FORMATS, type DatasetFormat } from '../../shared/constants/dataset-formats';

export const IMPORT_STATUSES = ['completed', 'aborted'] as const;

export type ImportStatus = (typeof IMPORT_STATUSES)[number];

export const MAX_REPORTED_ERRORS = 100;

export class ImportErrorDto {
  @ApiProperty({
    type: Number,
    nullable: true,
    description: '0-based record position in the file; null for database write errors',
  })
  readonly position: number | null;

  @ApiProperty({ type: String, nullable: true })
  readonly nasaId: string | null;

  @ApiProperty({ example: 'title must be a non-empty string' })
  readonly reason: string;
}

export class ImportReportDto {
  @ApiProperty({
    enum: IMPORT_STATUSES,
    description: 'aborted: the file could not be read to the end; earlier batches stay imported',
  })
  readonly status: ImportStatus;

  @ApiProperty({ enum: DATASET_FORMATS })
  readonly format: DatasetFormat;

  @ApiProperty({ description: 'Records read from the file' })
  readonly received: number;

  @ApiProperty({ description: 'Records that passed validation' })
  readonly valid: number;

  @ApiProperty({ description: 'Records that failed validation and were skipped' })
  readonly rejected: number;

  @ApiProperty({ description: 'New documents inserted' })
  readonly upserted: number;

  @ApiProperty({ description: 'Existing documents whose fields changed' })
  readonly modified: number;

  @ApiProperty({ description: 'Existing documents that already held the same data' })
  readonly unchanged: number;

  @ApiProperty({ description: 'Valid records the database refused' })
  readonly failed: number;

  @ApiProperty()
  readonly durationMs: number;

  @ApiPropertyOptional()
  readonly abortReason?: string;

  @ApiProperty({
    type: [ImportErrorDto],
    description: `The first ${MAX_REPORTED_ERRORS} errors`,
  })
  readonly errors: readonly ImportErrorDto[];

  @ApiProperty()
  readonly errorsTruncated: boolean;
}
