import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import type { ReactNode } from 'react';
import { useBookListParams } from './useBookListParams';

function setup(initial = '/books') {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>
  );
  return renderHook(
    () => ({ list: useBookListParams(), location: useLocation() }),
    { wrapper },
  );
}

const search = (result: ReturnType<typeof setup>['result']) =>
  result.current.location.search;

describe('useBookListParams', () => {
  it('reads the view from the URL', () => {
    const { result } = setup('/books?q=dune&page=3&sort=price:desc');

    expect(result.current.list.params).toMatchObject({
      search: 'dune',
      page: 3,
      sort: [{ field: 'price', direction: 'desc' }],
    });
  });

  it('uses the defaults, without error, for an empty or invalid URL', () => {
    const { result } = setup('/books?page=0&sort=foo:asc&availability=x');

    expect(result.current.list.params).toMatchObject({
      page: 1,
      limit: 10,
      sort: [],
      availability: undefined,
    });
  });

  describe('change', () => {
    it('writes the change in the URL and goes back to page 1', () => {
      const { result } = setup('/books?page=4');

      act(() => result.current.list.change({ search: 'dune' }));

      expect(search(result)).toBe('?q=dune');
      expect(result.current.list.params.page).toBe(1);
    });

    it('keeps the other filters and the order', () => {
      const { result } = setup('/books?author=herb&sort=price:asc&limit=20');

      act(() => result.current.list.change({ genre: 'novela' }));

      expect(result.current.list.params).toMatchObject({
        author: 'herb',
        genre: 'novela',
        limit: 20,
        sort: [{ field: 'price', direction: 'asc' }],
      });
    });

    it('can change several things at once', () => {
      const { result } = setup();

      act(() =>
        result.current.list.change({ search: 'a', availability: true }),
      );

      expect(search(result)).toBe('?q=a&availability=true');
    });

    it('applies two changes in a row without losing the first one', () => {
      const { result } = setup();

      act(() => {
        result.current.list.change({ search: 'dune' });
        result.current.list.change({ author: 'herb' });
      });

      expect(result.current.list.params).toMatchObject({
        search: 'dune',
        author: 'herb',
      });
    });

    it('adds a history entry by default', () => {
      const { result } = setup();

      act(() => result.current.list.change({ availability: true }));

      expect(result.current.location.key).not.toBe('default');
    });

    it('can replace the history entry instead (for text typed letter by letter)', () => {
      const { result } = setup();
      const before = result.current.location.key;

      act(() => result.current.list.change({ search: 'd' }, { replace: true }));

      expect(search(result)).toBe('?q=d');
      expect(before).toBe('default');
    });
  });

  describe('goToPage', () => {
    it('changes only the page', () => {
      const { result } = setup('/books?q=dune&sort=price:asc');

      act(() => result.current.list.goToPage(3));

      expect(result.current.list.params).toMatchObject({
        page: 3,
        search: 'dune',
        sort: [{ field: 'price', direction: 'asc' }],
      });
    });

    it('writes nothing for page 1', () => {
      const { result } = setup('/books?page=3');

      act(() => result.current.list.goToPage(1));

      expect(search(result)).toBe('');
    });
  });

  describe('toggleSort', () => {
    it('goes ascending, descending and off, back on page 1', () => {
      const { result } = setup('/books?page=5');

      act(() => result.current.list.toggleSort('price'));
      expect(result.current.list.params.sort).toEqual([
        { field: 'price', direction: 'asc' },
      ]);
      expect(result.current.list.params.page).toBe(1);

      act(() => result.current.list.toggleSort('price'));
      expect(result.current.list.params.sort).toEqual([
        { field: 'price', direction: 'desc' },
      ]);

      act(() => result.current.list.toggleSort('price'));
      expect(result.current.list.params.sort).toEqual([]);
    });

    it('adds a second column with lower priority', () => {
      const { result } = setup();

      act(() => result.current.list.toggleSort('genre'));
      act(() => result.current.list.toggleSort('price'));

      expect(search(result)).toBe('?sort=genre%3Aasc%2Cprice%3Aasc');
    });
  });

  it('clearSort removes the order and keeps the filters', () => {
    const { result } = setup('/books?q=dune&sort=price:asc');

    act(() => result.current.list.clearSort());

    expect(search(result)).toBe('?q=dune');
  });

  it('clearFilters removes every filter and keeps the order and the page size', () => {
    const { result } = setup(
      '/books?q=dune&author=a&publisher=b&genre=c&availability=true&sort=price:asc&limit=20&page=2',
    );

    act(() => result.current.list.clearFilters());

    expect(result.current.list.params).toMatchObject({
      search: '',
      author: '',
      publisher: '',
      genre: '',
      availability: undefined,
      page: 1,
      limit: 20,
      sort: [{ field: 'price', direction: 'asc' }],
    });
  });
});
