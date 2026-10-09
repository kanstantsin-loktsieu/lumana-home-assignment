import { BadRequestException } from '@nestjs/common';
import { ACTIVITY_RETENTION_DAYS, ACTIVITY_RETENTION_MS } from '@app/activity/activity-series';
import type { DateRange } from '@app/http/date-range';

export interface ReportRange {
  readonly fromMs: number;
  readonly toMs: number;
}

const DEFAULT_RANGE_MS = 24 * 60 * 60 * 1000;

export const toReportRange = ({ from, to }: DateRange, nowMs: number): ReportRange => {
  const toMs = to?.getTime() ?? nowMs;
  const fromMs = from?.getTime() ?? toMs - DEFAULT_RANGE_MS;
  if (fromMs >= toMs) throw new BadRequestException('`from` must be before `to`');
  // the time series hold no samples, and reject timestamps, before the Unix epoch
  if (fromMs < 0) throw new BadRequestException('The range must start at 1970-01-01 or later');
  if (toMs - fromMs > ACTIVITY_RETENTION_MS) {
    throw new BadRequestException(
      `The range must not exceed the ${ACTIVITY_RETENTION_DAYS}-day retention`,
    );
  }
  return { fromMs, toMs };
};
