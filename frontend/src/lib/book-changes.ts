import type { Book, BookChanges } from '../types/book';
import type { BookFormValues } from './book-schema';

/**
 * The fields of the form that differ from the saved book. Editing sends only
 * these (the API takes a partial update and rejects an empty one), so changing
 * the price never rewrites the title.
 */
export function changedFields(book: Book, values: BookFormValues): BookChanges {
  const changes: BookChanges = {};
  if (values.title !== book.title) changes.title = values.title;
  if (values.author !== book.author) changes.author = values.author;
  if (values.publisher !== book.publisher) changes.publisher = values.publisher;
  if (values.genre !== book.genre) changes.genre = values.genre;
  if (values.price !== book.price) changes.price = values.price;
  if (values.availability !== book.availability) {
    changes.availability = values.availability;
  }
  return changes;
}
