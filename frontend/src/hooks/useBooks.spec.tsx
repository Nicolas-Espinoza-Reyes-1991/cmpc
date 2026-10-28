import { renderHook, waitFor } from '@testing-library/react';
import { DEFAULT_PARAMS } from '../lib/book-list-params';
import { mockApi, type MockApi } from '../test/mock-api';
import { createQueryWrapper } from '../test/query-wrapper';
import type { Book, BookListParams } from '../types/book';
import { useBooks } from './useBooks';

const book = (id: string, title: string): Book => ({
  id,
  title,
  author: 'A',
  publisher: 'P',
  genre: 'G',
  price: 100,
  availability: true,
  imageUrl: null,
  createdAt: '2026-10-28T10:00:00.000Z',
  updatedAt: '2026-10-28T10:00:00.000Z',
});

describe('useBooks', () => {
  let api: MockApi;

  afterEach(() => {
    api.restore();
  });

  it('loads the page and the totals', async () => {
    api = mockApi({
      'GET /books': {
        data: {
          data: [book('1', 'Dune')],
          meta: { page: 1, limit: 10, total: 1 },
        },
      },
    });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useBooks(DEFAULT_PARAMS), { wrapper });

    await waitFor(() =>
      expect(result.current.data?.items.map((b) => b.title)).toEqual(['Dune']),
    );
    expect(result.current.data?.meta).toEqual({ page: 1, limit: 10, total: 1 });
  });

  it('sends the view to the API as its query string', async () => {
    api = mockApi({
      'GET /books': {
        data: { data: [], meta: { page: 2, limit: 20, total: 0 } },
      },
    });
    const { wrapper } = createQueryWrapper();
    const params: BookListParams = {
      ...DEFAULT_PARAMS,
      page: 2,
      limit: 20,
      search: 'dune',
      sort: [{ field: 'price', direction: 'desc' }],
    };

    renderHook(() => useBooks(params), { wrapper });

    await waitFor(() => expect(api.requests).toHaveLength(1));
    expect(api.requests[0]?.params).toMatchObject({
      page: 2,
      limit: 20,
      search: 'dune',
      sort: 'price:desc',
    });
  });

  it('keeps the previous page on screen while the next one loads', async () => {
    api = mockApi({
      'GET /books': (config) => {
        const { page } = config.params as { page: number };
        return {
          data: {
            data: [book(String(page), `Libro de la página ${page}`)],
            meta: { page, limit: 10, total: 20 },
          },
        };
      },
    });
    const { wrapper } = createQueryWrapper();
    const { result, rerender } = renderHook(
      ({ page }) => useBooks({ ...DEFAULT_PARAMS, page }),
      { wrapper, initialProps: { page: 1 } },
    );
    await waitFor(() =>
      expect(result.current.data?.items[0]?.title).toBe('Libro de la página 1'),
    );

    rerender({ page: 2 });

    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data?.items[0]?.title).toBe('Libro de la página 1');
    await waitFor(() =>
      expect(result.current.data?.items[0]?.title).toBe('Libro de la página 2'),
    );
  });

  it('files each view under its own key inside the ["books"] family', async () => {
    api = mockApi({
      'GET /books': {
        data: { data: [], meta: { page: 1, limit: 10, total: 0 } },
      },
    });
    const { wrapper, queryClient } = createQueryWrapper();

    renderHook(() => useBooks({ ...DEFAULT_PARAMS, search: 'dune' }), {
      wrapper,
    });

    await waitFor(() => expect(api.requests).toHaveLength(1));
    const keys = queryClient
      .getQueryCache()
      .getAll()
      .map((query) => query.queryKey);
    expect(keys).toHaveLength(1);
    expect(keys[0]?.[0]).toBe('books');
    expect(keys[0]?.[1]).toBe('list');
  });

  it('exposes the error and silences the global notice', async () => {
    api = mockApi({ 'GET /books': { status: 500, data: {} } });
    const { wrapper, queryClient } = createQueryWrapper();

    const { result } = renderHook(() => useBooks(DEFAULT_PARAMS), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 500 });
    expect(queryClient.getQueryCache().getAll()[0]?.meta).toEqual({
      silent: true,
    });
  });
});
