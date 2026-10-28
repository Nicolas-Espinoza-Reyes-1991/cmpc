import { PickType } from '@nestjs/swagger';
import { ListBooksQueryDto } from './list-books-query.dto';

/**
 * What the export accepts: the filters and the order of the listing, and
 * nothing about pages. It is built from the listing's own DTO so the two share
 * every rule and every error, and `page` and `limit` are rejected as unknown
 * properties (the export is all the matching books, not one page).
 */
export class ExportBooksQueryDto extends PickType(ListBooksQueryDto, [
  'search',
  'author',
  'publisher',
  'genre',
  'availability',
  'sort',
] as const) {}
