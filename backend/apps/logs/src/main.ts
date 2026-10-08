import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { MicroserviceOptions } from '@nestjs/microservices';
import { activityTransportOptions } from '@app/activity/activity-transport';
import { configureHttpApp } from '@app/http/configure-http-app';
import { AppModule } from './app.module';
import type { Environment } from './config/environment';

const bootstrap = async (): Promise<void> => {
  const app = await NestFactory.create(AppModule);
  configureHttpApp(app, {
    title: 'Logs service (B)',
    description:
      'Stores the activity events of the images service as logs, serves them with filters and ' +
      'renders a PDF activity report from the RedisTimeSeries data.',
  });
  const config = app.get<ConfigService<Environment, true>>(ConfigService);
  app.connectMicroservice<MicroserviceOptions>(
    activityTransportOptions(
      config.get('REDIS_HOST', { infer: true }),
      config.get('REDIS_PORT', { infer: true }),
    ),
  );
  await app.startAllMicroservices();
  await app.listen(config.get('LOGS_PORT', { infer: true }));
};

void bootstrap();
