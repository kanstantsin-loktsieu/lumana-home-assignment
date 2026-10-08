import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';
import { SharedEnvironment } from '@app/config/shared-environment';

const DEFAULT_FETCH_QUERIES = [
  'apollo',
  'mars',
  'moon',
  'earth',
  'nebula',
  'galaxy',
  'hubble',
  'shuttle',
  'iss',
  'saturn',
  'jupiter',
  'astronaut',
];

const toList = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string'
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    : value;

export class Environment extends SharedEnvironment {
  @IsInt()
  @Min(1)
  @Max(65535)
  readonly IMAGES_PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  readonly IMAGES_MONGO_DB: string = 'images';

  @IsString()
  @IsNotEmpty()
  readonly DATA_DIR: string = './data';

  @IsUrl({ require_tld: false })
  readonly NASA_API_URL: string = 'https://images-api.nasa.gov';

  @Transform(toList)
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  readonly NASA_FETCH_QUERIES: readonly string[] = DEFAULT_FETCH_QUERIES;

  @IsInt()
  @Min(100)
  @Max(100_000)
  readonly NASA_FETCH_TARGET: number = 20_000;

  // the NASA search API rejects page sizes above 100
  @IsInt()
  @Min(1)
  @Max(100)
  readonly NASA_PAGE_SIZE: number = 100;

  @IsInt()
  @Min(1)
  @Max(8)
  readonly NASA_FETCH_CONCURRENCY: number = 4;

  @IsInt()
  @Min(1)
  @Max(5000)
  readonly IMPORT_BATCH_SIZE: number = 500;

  @IsInt()
  @Min(1)
  @Max(1024)
  readonly UPLOAD_MAX_MB: number = 100;
}
