import { ApiProperty } from '@nestjs/swagger';
import { DATASET_FORMATS, type DatasetFormat } from '../../shared/constants/dataset-formats';

export const FETCH_STOP_REASONS = ['target-reached', 'queries-exhausted'] as const;

export type FetchStopReason = (typeof FETCH_STOP_REASONS)[number];

export class QueryFetchSummaryDto {
  @ApiProperty({ example: 'apollo' })
  readonly query: string;

  @ApiProperty({ description: 'Hits NASA reports for the query (only 10,000 are reachable)' })
  readonly totalHits: number;

  @ApiProperty()
  readonly pagesFetched: number;

  @ApiProperty({ description: 'Pages that still failed after retries and were skipped' })
  readonly pagesFailed: number;

  @ApiProperty({ description: 'Records not already seen in an earlier query' })
  readonly newRecords: number;
}

export class DatasetFileDto {
  @ApiProperty({ enum: DATASET_FORMATS })
  readonly format: DatasetFormat;

  @ApiProperty({ example: 'nasa-images.json' })
  readonly fileName: string;

  @ApiProperty()
  readonly bytes: number;
}

export class FetchSummaryDto {
  @ApiProperty({ description: 'Unique records written to each file' })
  readonly records: number;

  @ApiProperty({ enum: FETCH_STOP_REASONS })
  readonly stoppedBy: FetchStopReason;

  @ApiProperty()
  readonly durationMs: number;

  @ApiProperty({ type: [QueryFetchSummaryDto] })
  readonly queries: readonly QueryFetchSummaryDto[];

  @ApiProperty({ type: [DatasetFileDto] })
  readonly files: readonly DatasetFileDto[];
}
