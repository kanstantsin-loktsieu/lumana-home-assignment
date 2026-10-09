import { Controller, Get, Query, StreamableFile } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ACTIVITY_RETENTION_DAYS } from '@app/activity/activity-series';
import { parseDateRange } from '@app/http/date-range';
import { ActivityReports } from './activity-reports';
import { ActivityReportQueryDto } from './dto/activity-report-query';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ActivityReports) {}

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
  @ApiServiceUnavailableResponse({
    description: 'The report service is unavailable or did not answer within 10 s',
  })
  @ApiBadGatewayResponse({ description: 'The report service failed' })
  async activity(@Query() query: ActivityReportQueryDto): Promise<StreamableFile> {
    const { pdf, fileName } = await this.reports.render(parseDateRange(query.from, query.to));
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="${fileName}"`,
      length: pdf.length,
    });
  }
}
