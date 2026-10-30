const KEY = 'cmpc.listing.search';

/** What `location.search` can hold: empty, or a query string without a fragment. */
const VALID_SEARCH = /^\?[^#]*$/;

const listeners = new Set<() => void>();

/**
 * The last view of the books listing of this tab (`?q=dune&page=2…`). The view
 * lives in the URL, but opening a book leaves it behind: this is what lets every
 * way back return to the same filters, order and page. `sessionStorage` keeps it
 * per tab and across reloads; where it is missing or fails, the listing simply
 * opens without filters.
 */
export const listingView = {
  read: (): string => {
    try {
      const search = sessionStorage.getItem(KEY) ?? '';
      return VALID_SEARCH.test(search) ? search : '';
    } catch {
      return '';
    }
  },

  save: (search: string): void => {
    try {
      sessionStorage.setItem(KEY, search);
    } catch {
      // Without storage the view is just not remembered.
    }
    listeners.forEach((listener) => listener());
  },

  clear: (): void => {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      // Nothing to forget.
    }
    listeners.forEach((listener) => listener());
  },

  /** For `useSyncExternalStore`: links that point to the listing follow the saved view. */
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
