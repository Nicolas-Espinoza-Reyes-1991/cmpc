import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { cycleSort, readParams, writeParams } from '../lib/book-list-params';
import type { BookListParams, SortField } from '../types/book';

type Changes = Partial<Omit<BookListParams, 'page'>>;

interface ChangeOptions {
  /** Replace the history entry instead of adding one (for text typed one letter at a time). */
  replace?: boolean;
}

/**
 * The state of the listing, kept in the URL: reloading, going back and sharing
 * the link all keep the view. Every change that narrows or reorders the
 * listing goes back to page 1, because the current page may not exist anymore.
 *
 * Two changes in the same instant must both survive, but React Router's
 * `setSearchParams` does not queue them (its function form reads the URL of the
 * last render). So the hook keeps the last URL it wrote in a ref and builds each
 * change on top of it; after every render the ref is aligned with the real URL.
 */
export function useBookListParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useMemo(() => readParams(searchParams), [searchParams]);
  const latest = useRef(searchParams);
  useEffect(() => {
    latest.current = searchParams;
  }, [searchParams]);

  const update = useCallback(
    (
      build: (current: BookListParams) => BookListParams,
      { replace = false }: ChangeOptions = {},
    ) => {
      const next = writeParams(build(readParams(latest.current)));
      latest.current = next;
      setSearchParams(next, { replace });
    },
    [setSearchParams],
  );

  const change = useCallback(
    (changes: Changes, options?: ChangeOptions) =>
      update((current) => ({ ...current, ...changes, page: 1 }), options),
    [update],
  );

  const goToPage = useCallback(
    (page: number) => update((current) => ({ ...current, page })),
    [update],
  );

  const toggleSort = useCallback(
    (field: SortField) =>
      update((current) => ({
        ...current,
        sort: cycleSort(current.sort, field),
        page: 1,
      })),
    [update],
  );

  const clearSort = useCallback(() => change({ sort: [] }), [change]);

  const clearFilters = useCallback(
    () =>
      change({
        search: '',
        author: '',
        publisher: '',
        genre: '',
        availability: undefined,
      }),
    [change],
  );

  return { params, change, goToPage, toggleSort, clearSort, clearFilters };
}
