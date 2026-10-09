import type { CallOptions, Metadata } from '@grpc/grpc-js';
import type { Observable } from 'rxjs';
import type { ActivityReportServiceDefinition } from '../gen/report/v1/ActivityReportService';
import type { RenderActivityReportRequest__Output } from '../gen/report/v1/RenderActivityReportRequest';
import type { RenderActivityReportResponse__Output } from '../gen/report/v1/RenderActivityReportResponse';

// message types are generated from the proto (npm run generate:proto); only the service shape is
// written here, because Nest's ClientGrpc returns Observables instead of grpc-js callbacks
export type { Point__Output as Point } from '../gen/report/v1/Point';
export type { Series__Output as Series } from '../gen/report/v1/Series';

export type RenderActivityReportRequest = RenderActivityReportRequest__Output;

export type ActivitySeriesSet = Omit<RenderActivityReportRequest, 'fromMs' | 'toMs' | 'bucketMs'>;

// picking the rpc from the generated definition makes a renamed rpc fail to compile
type RenderRpc = keyof Pick<ActivityReportServiceDefinition, 'RenderActivityReport'>;

export type ActivityReportServiceClient = Record<
  Uncapitalize<RenderRpc>,
  (
    request: RenderActivityReportRequest,
    metadata: Metadata,
    options: CallOptions,
  ) => Observable<RenderActivityReportResponse__Output>
>;
