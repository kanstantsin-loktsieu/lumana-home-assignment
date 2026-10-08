import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { DATASET_FILE_NAMES, DATASET_MIME_TYPES } from '../shared/constants/dataset-formats';
import { DatasetFiles } from './dataset-files';
import { DatasetFetcher } from './dataset-fetcher';
import { DatasetFileParamsDto } from './dto/dataset-file-params';
import { FetchDatasetBodyDto } from './dto/fetch-dataset-body';
import { FetchSummaryDto } from './dto/fetch-summary';

@ApiTags('dataset')
@Controller('dataset')
export class DatasetController {
  constructor(
    private readonly fetcher: DatasetFetcher,
    private readonly files: DatasetFiles,
  ) {}

  @Post('fetch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Fetch a large NASA image dataset and save it as JSON and XLSX',
    description:
      'Pages through each query with a bounded number of parallel requests, deduplicates by ' +
      'NASA id and stops at the target. Runs synchronously; about a minute at the defaults.',
  })
  @ApiOkResponse({ type: FetchSummaryDto })
  @ApiConflictResponse({ description: 'A fetch is already running' })
  fetch(@Body() body: FetchDatasetBodyDto): Promise<FetchSummaryDto> {
    return this.fetcher.run(body);
  }

  @Get('files/:format')
  @ApiOperation({ summary: 'Download the last fetched dataset file' })
  @ApiProduces(DATASET_MIME_TYPES.json, DATASET_MIME_TYPES.xlsx)
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  @ApiNotFoundResponse({ description: 'No dataset has been fetched yet' })
  async download(@Param() { format }: DatasetFileParamsDto): Promise<StreamableFile> {
    const path = this.files.pathFor(format);
    const file = await stat(path).catch(() => null);
    if (file === null) {
      throw new NotFoundException('No dataset file yet; run POST /dataset/fetch first');
    }
    return new StreamableFile(createReadStream(path), {
      type: DATASET_MIME_TYPES[format],
      disposition: `attachment; filename="${DATASET_FILE_NAMES[format]}"`,
      length: file.size,
    });
  }
}
