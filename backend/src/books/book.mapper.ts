import type { Prisma } from '@prisma/client';
import type { AuditSnapshot } from '../audit/audit.types';
import type { BookDto } from './dto/book.dto';

/** What every book query includes, so the mapper can read the catalog names. */
export const BOOK_INCLUDE = {
  author: true,
  publisher: true,
  genre: true,
} satisfies Prisma.BookInclude;

export type BookWithCatalogs = Prisma.BookGetPayload<{
  include: typeof BOOK_INCLUDE;
}>;

/**
 * The one place that turns a database row into the API shape: names instead of
 * ids, `price` as a number (Decimal(10,2) fits a double exactly) and no
 * `deletedAt`.
 */
export function toBookDto(book: BookWithCatalogs): BookDto {
  return {
    id: book.id,
    title: book.title,
    author: book.author.name,
    publisher: book.publisher.name,
    genre: book.genre.name,
    price: book.price.toNumber(),
    availability: book.availability,
    imageUrl: book.imageUrl,
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
  };
}

/**
 * What the audit trail keeps of a book: its business data, without timestamps
 * (the entry has its own) and without anything internal (G2.7).
 */
export function toAuditSnapshot(book: BookDto): AuditSnapshot {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    publisher: book.publisher,
    genre: book.genre,
    price: book.price,
    availability: book.availability,
    imageUrl: book.imageUrl,
  };
}
