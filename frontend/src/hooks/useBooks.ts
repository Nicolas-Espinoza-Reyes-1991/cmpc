import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { toApiQuery } from '../lib/book-list-params';
import { listBooks } from '../services/books.service';
import type { BookListParams } from '../types/book';

/**
 * One view of the listing. The key starts with `['books']`, the family that
 * saving or deleting a book marks as stale, so the list is never out of date
 * after a change. While the next page loads the previous one stays on screen
 * (no flicker); the page shows its own error, so the global notice is silenced.
 */
export function useBooks(params: BookListParams) {
  return useQuery({
    queryKey: ['books', 'list', toApiQuery(params)],
    queryFn: ({ signal }) => listBooks(params, signal),
    placeholderData: keepPreviousData,
    meta: { silent: true },
  });
}
