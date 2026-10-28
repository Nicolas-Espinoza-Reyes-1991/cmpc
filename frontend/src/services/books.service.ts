import { apiClient } from '../lib/api-client';
import type { ApiResponse } from '../types/api';
import type { Book, BookChanges, BookInput } from '../types/book';

/** Registers a book; the API creates the author, publisher and genre if they are new. */
export async function createBook(input: BookInput): Promise<Book> {
  const response = await apiClient.post<ApiResponse<Book>>('/books', input);
  return response.data.data;
}

/** `signal` lets TanStack Query cancel the request when the screen goes away. */
export async function getBook(id: string, signal?: AbortSignal): Promise<Book> {
  const response = await apiClient.get<ApiResponse<Book>>(
    `/books/${encodeURIComponent(id)}`,
    { signal },
  );
  return response.data.data;
}

/** Sends only the fields to change. */
export async function updateBook(
  id: string,
  changes: BookChanges,
): Promise<Book> {
  const response = await apiClient.patch<ApiResponse<Book>>(
    `/books/${encodeURIComponent(id)}`,
    changes,
  );
  return response.data.data;
}

/** Soft delete: the API answers 204 with no body. */
export async function deleteBook(id: string): Promise<void> {
  await apiClient.delete(`/books/${encodeURIComponent(id)}`);
}
