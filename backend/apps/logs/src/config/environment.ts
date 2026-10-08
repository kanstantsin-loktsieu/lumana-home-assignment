import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';
import { SharedEnvironment } from '@app/config/shared-environment';

export class Environment extends SharedEnvironment {
  @IsInt()
  @Min(1)
  @Max(65535)
  readonly LOGS_PORT: number = 3001;

  @IsString()
  @IsNotEmpty()
  readonly LOGS_MONGO_DB: string = 'logs';

  // host:port without a scheme, as grpc-js expects
  @IsString()
  @IsNotEmpty()
  readonly REPORT_GRPC_URL: string = 'localhost:50051';
}
