import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { DATASET_FORMATS, type DatasetFormat } from '../../shared/constants/dataset-formats';

export class DatasetFileParamsDto {
  @ApiProperty({ enum: DATASET_FORMATS })
  @IsIn(DATASET_FORMATS)
  readonly format: DatasetFormat;
}
