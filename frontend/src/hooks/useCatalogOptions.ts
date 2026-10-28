import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { listCatalog } from '../services/catalog.service';
import type { CatalogKind } from '../types/book';
import { useDebounce } from './useDebounce';

const DEBOUNCE_MS = 250;
const SUGGESTIONS = 10;
const STALE_MS = 30_000;

/**
 * Suggestions for a catalog field. The request waits until the user stops
 * typing. A failure only means no suggestions (the user can still type any
 * name), so the global notice is silenced.
 */
export function useCatalogOptions(kind: CatalogKind, text: string) {
  const search = useDebounce(text.trim(), DEBOUNCE_MS);

  return useQuery({
    queryKey: ['catalog', kind, search],
    queryFn: ({ signal }) =>
      listCatalog(kind, { search, limit: SUGGESTIONS }, signal),
    staleTime: STALE_MS,
    // Keep showing the previous suggestions while the next ones load.
    placeholderData: keepPreviousData,
    meta: { silent: true },
  });
}
