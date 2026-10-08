import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export interface HttpAppInfo {
  readonly title: string;
  readonly description: string;
}

export const configureHttpApp = (app: INestApplication, info: HttpAppInfo): void => {
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();
  const config = new DocumentBuilder()
    .setTitle(info.title)
    .setDescription(info.description)
    .setVersion('1.0')
    .build();
  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, config), {
    jsonDocumentUrl: 'docs-json',
  });
};
