import type { PaginationMeta } from './api';

// Contract of the books and catalog endpoints (backend `BookDto`, `CreateBookDto`,
// `UpdateBookDto` and `CatalogItemDto`). Keep them aligned with Swagger.

/** A book as the API returns it: catalog entries by name, price as a number. */
export interface Book {
  id: string;
  title: string;
  author: string;
  publisher: string;
  genre: string;
  price: number;
  availability: boolean;
  /** Cover image URL; `null` until the image upload spec sets one. */
  imageUrl: string | null;
  /** ISO 8601 moments. */
  createdAt: string;
  updatedAt: string;
}

/** What the form sends to register a book. */
export interface BookInput {
  title: string;
  author: string;
  publisher: string;
  genre: string;
  price: number;
  availability: boolean;
}

/** Any subset of the creation fields (the API needs at least one). */
export type BookChanges = Partial<BookInput>;

/** The catalogs a book points to; the value is also the route that lists them. */
export type CatalogKind = 'authors' | 'publishers' | 'genres';

export interface CatalogItem {
  id: string;
  name: string;
}

/** The columns the listing can be ordered by (the API accepts the same ones). */
export type SortField =
  | 'title'
  | 'author'
  | 'publisher'
  | 'genre'
  | 'price'
  | 'availability'
  | 'createdAt';

export type SortDirection = 'asc' | 'desc';

export interface SortCriterion {
  field: SortField;
  direction: SortDirection;
}

/** Everything that defines one view of the listing. It lives in the URL. */
export interface BookListParams {
  page: number;
  limit: number;
  /** Text contained in the title. Empty means no search. */
  search: string;
  author: string;
  publisher: string;
  genre: string;
  /** `undefined` means "all". */
  availability: boolean | undefined;
  /** In priority order. Empty means the API default: newest first. */
  sort: SortCriterion[];
}

/** One page of a listing with the totals that come with it. */
export interface Page<T> {
  items: T[];
  meta: PaginationMeta;
}

/** What the user decided about the cover in the form, besides the book data. */
export interface ImageChoice {
  /** A new file to upload (validated), or `null`. */
  image: File | null;
  /** Remove the current cover when saving (only meaningful without a new file). */
  removeImage: boolean;
}
