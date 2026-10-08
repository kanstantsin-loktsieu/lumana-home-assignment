import {
  ConfigurableModuleBuilder,
  Inject,
  Logger,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { createRedisClient, REDIS_CLIENT, type RedisClient } from './redis-client';

export interface RedisModuleOptions {
  readonly host: string;
  readonly port: number;
}

const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<RedisModuleOptions>()
    .setClassMethodName('forRoot')
    .setExtras({}, (definition) => ({ ...definition, global: true }))
    .build();

@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [MODULE_OPTIONS_TOKEN],
      useFactory: async (options: RedisModuleOptions): Promise<RedisClient> => {
        const logger = new Logger('Redis');
        const client = createRedisClient(options.host, options.port);
        client.on('error', (error: Error) => logger.error(error.message));
        await client.connect();
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule extends ConfigurableModuleClass implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly client: RedisClient) {
    super();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.client.isOpen) await this.client.close();
  }
}
