import { Module } from '@nestjs/common';
import { ImageImporter } from './image-importer';
import { ImagesController } from './images.controller';
import { ImagesRepository } from './images-repository';

@Module({
  controllers: [ImagesController],
  providers: [ImagesRepository, ImageImporter],
})
export class ImagesModule {}
