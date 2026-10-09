import { Injectable } from '@nestjs/common';
import type { DateRange } from '@app/http/date-range';
import { ActivityReportClient } from './activity-report-client';
import { ActivitySeriesReader } from './activity-series-reader';
import { pickBucketMs } from './utils/report-bucket';
import { toReportRange } from './utils/report-range';

export interface ActivityReportFile {
  readonly pdf: Buffer;
  readonly fileName: string;
}

const fileStamp = (ms: number): string =>
  new Date(ms).toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-').concat('Z');

@Injectable()
export class ActivityReports {
  constructor(
    private readonly reader: ActivitySeriesReader,
    private readonly client: ActivityReportClient,
  ) {}

  async render(range: DateRange): Promise<ActivityReportFile> {
    const { fromMs, toMs } = toReportRange(range, Date.now());
    const bucketMs = pickBucketMs(fromMs, toMs);
    const series = await this.reader.read(fromMs, toMs, bucketMs);
    const pdf = await this.client.render({ fromMs, toMs, bucketMs, ...series });
    return { pdf, fileName: `activity-report-${fileStamp(fromMs)}-${fileStamp(toMs)}.pdf` };
  }
}
