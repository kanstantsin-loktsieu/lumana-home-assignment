import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { validateEnvironment } from '@app/config/validate-environment';
import { MongoModule } from '@app/mongo/mongo.module';
import { RedisModule } from '@app/redis/redis.module';
import { Environment } from './config/environment';
import { LogsModule } from './logs/logs.module';
import { ReportsModule } from './reports/reports.module';

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
        dbName: config.get('LOGS_MONGO_DB', { infer: true }),
        appName: 'logs',
      }),
    }),
    RedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => ({
        host: config.get('REDIS_HOST', { infer: true }),
        port: config.get('REDIS_PORT', { infer: true }),
      }),
    }),
    LogsModule,
    ReportsModule,
  ],
})
export class AppModule {}
