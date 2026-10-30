import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { listingView } from '../lib/listingView';
import { useListingPath } from './useListingPath';

describe('useListingPath', () => {
  afterEach(() => {
    listingView.clear();
  });

  it('is the plain listing when no view was saved', () => {
    const { result } = renderHook(() => useListingPath());

    expect(result.current).toBe('/books');
  });

  it('is the listing with the saved view', () => {
    listingView.save('?q=dune&page=2');

    const { result } = renderHook(() => useListingPath());

    expect(result.current).toBe('/books?q=dune&page=2');
  });

  it('follows the view when it changes while mounted', () => {
    const { result } = renderHook(() => useListingPath());

    act(() => listingView.save('?availability=true'));
    expect(result.current).toBe('/books?availability=true');

    act(() => listingView.clear());
    expect(result.current).toBe('/books');
  });
});
