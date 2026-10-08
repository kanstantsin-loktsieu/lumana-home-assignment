import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ClientsModule } from '@nestjs/microservices';
import { ACTIVITY_CLIENT, activityTransportOptions } from '@app/activity/activity-transport';
import type { Environment } from '../config/environment';
import { ActivityInterceptor } from './activity-interceptor';
import { ActivityRecorder } from './activity-recorder';
import { ActivitySeriesWriter } from './activity-series-writer';

@Global()
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: ACTIVITY_CLIENT,
        inject: [ConfigService],
        useFactory: (config: ConfigService<Environment, true>) =>
          activityTransportOptions(
            config.get('REDIS_HOST', { infer: true }),
            config.get('REDIS_PORT', { infer: true }),
          ),
      },
    ]),
  ],
  providers: [
    ActivitySeriesWriter,
    ActivityRecorder,
    { provide: APP_INTERCEPTOR, useClass: ActivityInterceptor },
  ],
  exports: [ActivityRecorder],
})
export class ActivityModule {}
