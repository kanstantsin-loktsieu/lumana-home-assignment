import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { KEYSET_PAGINATION_DESCRIPTION, parseCursor } from '@app/http/cursor-page';
import { parseDateRange } from '@app/http/date-range';
import { LogPageDto } from './dto/log-page';
import { LogTypeCountDto } from './dto/log-type-count';
import { QueryLogsDto } from './dto/query-logs';
import { LogsRepository } from './logs-repository';

@ApiTags('logs')
@Controller('logs')
export class LogsController {
  constructor(private readonly repository: LogsRepository) {}

  @Get()
  @ApiOperation({ summary: 'Query activity logs', description: KEYSET_PAGINATION_DESCRIPTION })
  @ApiOkResponse({ type: LogPageDto })
  @ApiBadRequestResponse({ description: 'Invalid filter or cursor' })
  query(@Query() query: QueryLogsDto): Promise<LogPageDto> {
    const { from, to } = parseDateRange(query.from, query.to);
    return this.repository.query({
      from,
      to,
      kind: query.kind,
      type: query.type,
      level: query.level,
      limit: query.limit,
      cursor: parseCursor(query.cursor),
    });
  }

  @Get('types')
  @ApiOperation({ summary: 'List log types with their counts, to discover filter values' })
  @ApiOkResponse({ type: [LogTypeCountDto] })
  types(): Promise<LogTypeCountDto[]> {
    return this.repository.typeCounts();
  }
}
