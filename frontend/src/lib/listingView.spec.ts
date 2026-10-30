import { afterEach, describe, expect, it, vi } from 'vitest';
import { listingView } from './listingView';

describe('listingView', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('is empty until a view is saved', () => {
    expect(listingView.read()).toBe('');
  });

  it('gives back what was saved', () => {
    listingView.save('?q=dune&page=2');

    expect(listingView.read()).toBe('?q=dune&page=2');
  });

  it('forgets the view when cleared', () => {
    listingView.save('?page=3');

    listingView.clear();

    expect(listingView.read()).toBe('');
  });

  it('ignores a stored value that is not a query string', () => {
    sessionStorage.setItem('cmpc.listing.search', 'https://evil.test/x');

    expect(listingView.read()).toBe('');
  });

  it('tells the subscribers when the view changes, until they unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = listingView.subscribe(listener);

    listingView.save('?page=2');
    listingView.clear();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    listingView.save('?page=4');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  describe('without a usable storage', () => {
    it('reads an empty view when the storage throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });

      expect(listingView.read()).toBe('');
    });

    it('does not fail when saving or clearing throws, and still tells the subscribers', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('full');
      });
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      const listener = vi.fn();
      const unsubscribe = listingView.subscribe(listener);

      expect(() => listingView.save('?page=2')).not.toThrow();
      expect(() => listingView.clear()).not.toThrow();
      expect(listener).toHaveBeenCalledTimes(2);
      unsubscribe();
    });
  });
});
