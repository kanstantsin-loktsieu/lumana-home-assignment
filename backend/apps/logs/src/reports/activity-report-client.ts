import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  type OnModuleInit,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { Metadata, status as GrpcStatus } from '@grpc/grpc-js';
import { errorMessage } from '@app/common/error-message';
import { isRecord } from '@app/common/type-guards';
import { lastValueFrom } from 'rxjs';
import type {
  ActivityReportServiceClient,
  RenderActivityReportRequest,
} from './models/activity-report-rpc';

export const REPORT_CLIENT = Symbol('REPORT_CLIENT');

// a 30-day report renders in about 0.3 s; the deadline tells the Go service when to stop
const RENDER_DEADLINE_MS = 10_000;

const grpcCodeOf = (error: unknown): number | null =>
  isRecord(error) && typeof error['code'] === 'number' ? error['code'] : null;

const grpcDetailsOf = (error: unknown): string =>
  isRecord(error) && typeof error['details'] === 'string' ? error['details'] : errorMessage(error);

@Injectable()
export class ActivityReportClient implements OnModuleInit {
  private readonly logger = new Logger(ActivityReportClient.name);
  private service: ActivityReportServiceClient;

  constructor(@Inject(REPORT_CLIENT) private readonly grpc: ClientGrpc) {}

  onModuleInit(): void {
    this.service = this.grpc.getService<ActivityReportServiceClient>('ActivityReportService');
  }

  async render(request: RenderActivityReportRequest): Promise<Buffer> {
    try {
      const response = await lastValueFrom(
        this.service.renderActivityReport(request, new Metadata(), {
          deadline: Date.now() + RENDER_DEADLINE_MS,
        }),
      );
      return response.pdf;
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  // only invalid-argument details are meant for clients; anything else can carry internal
  // addresses or library errors, so it is logged and replaced by a fixed message
  private toHttpError(error: unknown): Error {
    const code = grpcCodeOf(error);
    if (code === GrpcStatus.INVALID_ARGUMENT) return new BadRequestException(grpcDetailsOf(error));
    this.logger.error(
      `Report rendering failed (gRPC code ${code ?? 'none'}): ${errorMessage(error)}`,
    );
    return code === GrpcStatus.UNAVAILABLE || code === GrpcStatus.DEADLINE_EXCEEDED
      ? new ServiceUnavailableException('The report service is unavailable')
      : new BadGatewayException('The report service failed');
  }
}
