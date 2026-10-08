import { Controller, Get, HttpCode, HttpStatus, Post, Query, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { KEYSET_PAGINATION_DESCRIPTION, parseCursor } from '@app/http/cursor-page';
import { parseDateRange } from '@app/http/date-range';
import { ImagePageDto } from './dto/image-page';
import { ImportReportDto } from './dto/import-report';
import { SearchImagesQueryDto } from './dto/search-images-query';
import { ImageImporter } from './image-importer';
import { ImagesRepository } from './images-repository';

@ApiTags('images')
@Controller('images')
export class ImagesController {
  constructor(
    private readonly repository: ImagesRepository,
    private readonly importer: ImageImporter,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Search imported images',
    description: KEYSET_PAGINATION_DESCRIPTION,
  })
  @ApiOkResponse({ type: ImagePageDto })
  @ApiBadRequestResponse({ description: 'Invalid filter or cursor' })
  search(@Query() query: SearchImagesQueryDto): Promise<ImagePageDto> {
    const { from, to } = parseDateRange(query.from, query.to);
    return this.repository.search({
      q: query.q,
      center: query.center,
      keyword: query.keyword,
      from,
      to,
      limit: query.limit,
      cursor: parseCursor(query.cursor),
    });
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Import a dataset file (.json or .xlsx) into MongoDB',
    description:
      'Streams and validates the file, then upserts in batches by NASA id, so importing the ' +
      'same file twice changes nothing. Invalid records are reported and skipped.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ type: ImportReportDto })
  @ApiBadRequestResponse({ description: 'Unreadable file; the body is the partial report' })
  @ApiPayloadTooLargeResponse({ description: 'File over UPLOAD_MAX_MB; partial report' })
  @ApiUnsupportedMediaTypeResponse({ description: 'Not a .json or .xlsx file' })
  import(@Req() request: Request): Promise<ImportReportDto> {
    return this.importer.import(request);
  }
}
