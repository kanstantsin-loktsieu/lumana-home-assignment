import type { Observable } from 'rxjs';

// hand-written mirror of `proto/report/v1/activity_report.proto` as loaded with
// `keepCase: false, longs: Number`; keep both in step
export interface Point {
  readonly timestampMs: number;
  readonly value: number;
}

export interface Series {
  readonly label: string;
  readonly points: readonly Point[];
}

export interface ActivitySeriesSet {
  readonly requestsByRoute: readonly Series[];
  readonly requestsByOutcome: readonly Series[];
  readonly avgLatencyByRoute: readonly Series[];
  readonly maxLatencyByRoute: readonly Series[];
  readonly domainEventsByName: readonly Series[];
}

export interface RenderActivityReportRequest extends ActivitySeriesSet {
  readonly fromMs: number;
  readonly toMs: number;
  readonly bucketMs: number;
}

export interface RenderActivityReportResponse {
  readonly pdf: Buffer;
}

export interface ActivityReportServiceClient {
  renderActivityReport(
    request: RenderActivityReportRequest,
  ): Observable<RenderActivityReportResponse>;
}
