import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';

/** PrismaModule is global; `CatalogModule` supplies the catalog resolver. */
@Module({
  imports: [CatalogModule],
  controllers: [BooksController],
  providers: [BooksService],
})
export class BooksModule {}
