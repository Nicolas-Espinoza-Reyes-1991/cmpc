import { useQuery } from '@tanstack/react-query';
import { getBook } from '../services/books.service';

/** Query key of one book. Lists use `['books', 'list', ...]`, so `['books']` covers both. */
export const bookKey = (id: string) => ['books', id] as const;

/**
 * One book by id. The page shows its own "not found" and error states, so the
 * global notice is silenced (`meta.silent`).
 */
export function useBook(id: string) {
  return useQuery({
    queryKey: bookKey(id),
    queryFn: ({ signal }) => getBook(id, signal),
    meta: { silent: true },
  });
}
