import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  type OnModuleInit,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { errorMessage } from '@app/common/error-message';
import { isRecord } from '@app/common/type-guards';
import { lastValueFrom, timeout, TimeoutError } from 'rxjs';
import type {
  ActivityReportServiceClient,
  RenderActivityReportRequest,
} from './models/activity-report-rpc';

export const REPORT_CLIENT = Symbol('REPORT_CLIENT');

const RENDER_TIMEOUT_MS = 30_000;

const grpcCodeOf = (error: unknown): number | null =>
  isRecord(error) && typeof error['code'] === 'number' ? error['code'] : null;

const toHttpError = (error: unknown): Error => {
  const message = errorMessage(error);
  if (error instanceof TimeoutError) {
    return new ServiceUnavailableException('The report service did not answer in time');
  }
  switch (grpcCodeOf(error)) {
    case GrpcStatus.UNAVAILABLE:
    case GrpcStatus.DEADLINE_EXCEEDED:
      return new ServiceUnavailableException(`The report service is unavailable: ${message}`);
    case GrpcStatus.INVALID_ARGUMENT:
      return new BadRequestException(message);
    default:
      return new BadGatewayException(`The report service failed: ${message}`);
  }
};

@Injectable()
export class ActivityReportClient implements OnModuleInit {
  private service: ActivityReportServiceClient;

  constructor(@Inject(REPORT_CLIENT) private readonly grpc: ClientGrpc) {}

  onModuleInit(): void {
    this.service = this.grpc.getService<ActivityReportServiceClient>('ActivityReportService');
  }

  async render(request: RenderActivityReportRequest): Promise<Buffer> {
    try {
      const response = await lastValueFrom(
        this.service.renderActivityReport(request).pipe(timeout(RENDER_TIMEOUT_MS)),
      );
      return response.pdf;
    } catch (error) {
      throw toHttpError(error);
    }
  }
}
