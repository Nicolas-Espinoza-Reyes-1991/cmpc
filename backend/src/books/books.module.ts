import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { ImageStorage } from './images/image-storage';

/** PrismaModule is global; `CatalogModule` supplies the catalog resolver. */
@Module({
  imports: [CatalogModule],
  controllers: [BooksController],
  providers: [BooksService, ImageStorage],
})
export class BooksModule {}
