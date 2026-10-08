import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import type { Environment } from '../config/environment';
import { ActivityReportClient, REPORT_CLIENT } from './activity-report-client';
import { ActivitySeriesReader } from './activity-series-reader';
import { ReportsController } from './reports.controller';

const MAX_MESSAGE_BYTES = 16 * 2 ** 20;

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: REPORT_CLIENT,
        inject: [ConfigService],
        useFactory: (config: ConfigService<Environment, true>) => ({
          transport: Transport.GRPC,
          options: {
            url: config.get('REPORT_GRPC_URL', { infer: true }),
            package: 'report.v1',
            // resolved from the working directory: backend/ locally, /app in the container
            protoPath: join(process.cwd(), 'proto/report/v1/activity_report.proto'),
            loader: { keepCase: false, longs: Number, defaults: true },
            maxReceiveMessageLength: MAX_MESSAGE_BYTES,
            maxSendMessageLength: MAX_MESSAGE_BYTES,
          },
        }),
      },
    ]),
  ],
  controllers: [ReportsController],
  providers: [ActivitySeriesReader, ActivityReportClient],
})
export class ReportsModule {}
