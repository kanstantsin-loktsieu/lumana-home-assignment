import { IsInt, IsString, Matches, Max, Min } from 'class-validator';

export class SharedEnvironment {
  // a URL check would reject valid multi-host strings such as mongodb://a:27017,b:27017/?replicaSet=rs0
  @Matches(/^mongodb(\+srv)?:\/\/\S+$/, {
    message: 'MONGO_URL must be a mongodb:// or mongodb+srv:// connection string',
  })
  readonly MONGO_URL: string;

  @IsString()
  readonly REDIS_HOST: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  readonly REDIS_PORT: number;
}
