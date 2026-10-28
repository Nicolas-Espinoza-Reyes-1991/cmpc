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
