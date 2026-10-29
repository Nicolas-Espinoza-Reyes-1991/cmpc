import { ApiProperty } from '@nestjs/swagger';
import { BookDto } from './book.dto';

class PaginationMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({
    example: 42,
    description: 'Books that match the filters, not just this page.',
  })
  total!: number;
}

/** The whole response of the listing: the interceptor wraps the page as `{ data, meta }`. */
export class PaginatedBooksDto {
  @ApiProperty({ type: [BookDto] })
  data!: BookDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
