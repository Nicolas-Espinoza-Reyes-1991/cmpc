import { useSyncExternalStore } from 'react';
import { listingView } from '../lib/listingView';

const getPath = () => `/books${listingView.read()}`;

/** Where "back to the books" goes: the listing with the view the user left. */
export function useListingPath(): string {
  return useSyncExternalStore(listingView.subscribe, getPath);
}
