import {
  ConfigurableModuleBuilder,
  Inject,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { MongoClient } from 'mongodb';
import { MONGO_CLIENT, MONGO_DB } from './mongo-tokens';

export interface MongoModuleOptions {
  readonly url: string;
  readonly dbName: string;
  readonly appName: string;
}

const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<MongoModuleOptions>()
    .setClassMethodName('forRoot')
    .setExtras({}, (definition) => ({ ...definition, global: true }))
    .build();

@Module({
  providers: [
    {
      provide: MONGO_CLIENT,
      inject: [MODULE_OPTIONS_TOKEN],
      useFactory: async (options: MongoModuleOptions): Promise<MongoClient> => {
        const client = new MongoClient(options.url, { appName: options.appName });
        await client.connect();
        await client.db(options.dbName).command({ ping: 1 });
        return client;
      },
    },
    {
      provide: MONGO_DB,
      inject: [MONGO_CLIENT, MODULE_OPTIONS_TOKEN],
      useFactory: (client: MongoClient, options: MongoModuleOptions) => client.db(options.dbName),
    },
  ],
  exports: [MONGO_DB],
})
export class MongoModule extends ConfigurableModuleClass implements OnApplicationShutdown {
  constructor(@Inject(MONGO_CLIENT) private readonly client: MongoClient) {
    super();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }
}
