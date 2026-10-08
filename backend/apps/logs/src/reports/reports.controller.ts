import { BadRequestException, Controller, Get, Query, StreamableFile } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ACTIVITY_RETENTION_DAYS, ACTIVITY_RETENTION_MS } from '@app/activity/activity-series';
import { parseDateRange } from '@app/http/date-range';
import { ActivityReportClient } from './activity-report-client';
import { ActivitySeriesReader } from './activity-series-reader';
import { ActivityReportQueryDto } from './dto/activity-report-query';
import { pickBucketMs } from './utils/report-bucket';

const DEFAULT_RANGE_MS = 24 * 60 * 60 * 1000;

const fileStamp = (ms: number): string =>
  new Date(ms).toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-').concat('Z');

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reader: ActivitySeriesReader,
    private readonly client: ActivityReportClient,
  ) {}

  @Get('activity')
  @ApiOperation({
    summary: 'PDF activity report of the images service',
    description:
      `Reads the RedisTimeSeries data for the range (at most ${ACTIVITY_RETENTION_DAYS} days, the ` +
      'retention) and has the ' +
      'Go report service render it over gRPC: KPIs, four labelled charts and a route table.',
  })
  @ApiProduces('application/pdf')
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  @ApiBadRequestResponse({ description: 'Invalid range' })
  @ApiServiceUnavailableResponse({ description: 'The report service is not reachable' })
  @ApiBadGatewayResponse({ description: 'The report service failed' })
  async activity(@Query() query: ActivityReportQueryDto): Promise<StreamableFile> {
    const range = parseDateRange(query.from, query.to);
    const toMs = range.to?.getTime() ?? Date.now();
    const fromMs = range.from?.getTime() ?? toMs - DEFAULT_RANGE_MS;
    if (fromMs >= toMs) throw new BadRequestException('`from` must be before `to`');
    // the time series hold no samples, and reject timestamps, before the Unix epoch
    if (fromMs < 0) throw new BadRequestException('The range must start at 1970-01-01 or later');
    if (toMs - fromMs > ACTIVITY_RETENTION_MS) {
      throw new BadRequestException(
        `The range must not exceed the ${ACTIVITY_RETENTION_DAYS}-day retention`,
      );
    }
    const bucketMs = pickBucketMs(fromMs, toMs);
    const series = await this.reader.read(fromMs, toMs, bucketMs);
    const pdf = await this.client.render({ fromMs, toMs, bucketMs, ...series });
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="activity-report-${fileStamp(fromMs)}-${fileStamp(toMs)}.pdf"`,
      length: pdf.length,
    });
  }
}
