import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { validateEnvironment } from '@app/config/validate-environment';
import { MongoModule } from '@app/mongo/mongo.module';
import { RedisModule } from '@app/redis/redis.module';
import { ActivityModule } from './activity/activity.module';
import { Environment } from './config/environment';
import { DatasetModule } from './dataset/dataset.module';
import { ImagesModule } from './images/images.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment(Environment),
    }),
    MongoModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => ({
        url: config.get('MONGO_URL', { infer: true }),
        dbName: config.get('IMAGES_MONGO_DB', { infer: true }),
        appName: 'images',
      }),
    }),
    RedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => ({
        host: config.get('REDIS_HOST', { infer: true }),
        port: config.get('REDIS_PORT', { infer: true }),
      }),
    }),
    ActivityModule,
    DatasetModule,
    ImagesModule,
  ],
})
export class AppModule {}
