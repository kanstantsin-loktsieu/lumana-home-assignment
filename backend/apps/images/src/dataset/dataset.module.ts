import { Module } from '@nestjs/common';
import { DatasetController } from './dataset.controller';
import { DatasetFetcher } from './dataset-fetcher';
import { DatasetFiles } from './dataset-files';
import { NasaImagesClient } from './nasa-images-client';

@Module({
  controllers: [DatasetController],
  providers: [DatasetFetcher, DatasetFiles, NasaImagesClient],
})
export class DatasetModule {}
