import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { configureHttpApp } from '@app/http/configure-http-app';
import { AppModule } from './app.module';
import type { Environment } from './config/environment';

const bootstrap = async (): Promise<void> => {
  const app = await NestFactory.create(AppModule);
  configureHttpApp(app, {
    title: 'Images service (A)',
    description:
      'Fetches a NASA Image Library dataset to JSON and XLSX, imports such files into MongoDB ' +
      'and searches the imported records. Every action is recorded in RedisTimeSeries and ' +
      'published to the logs service.',
  });
  const config = app.get<ConfigService<Environment, true>>(ConfigService);
  await app.listen(config.get('IMAGES_PORT', { infer: true }));
};

void bootstrap();
