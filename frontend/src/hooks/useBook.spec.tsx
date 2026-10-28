import { renderHook, waitFor } from '@testing-library/react';
import { mockApi, type MockApi } from '../test/mock-api';
import { createQueryWrapper } from '../test/query-wrapper';
import type { Book } from '../types/book';
import { bookKey, useBook } from './useBook';

const ID = '3f6c2a52-7f0e-4c3e-9d57-1d8f0f6a9b11';
const book: Book = {
  id: ID,
  title: 'Dune',
  author: 'Frank Herbert',
  publisher: 'Ace',
  genre: 'Ciencia ficción',
  price: 9990,
  availability: true,
  imageUrl: null,
  createdAt: '2026-10-28T10:00:00.000Z',
  updatedAt: '2026-10-28T10:00:00.000Z',
};

describe('useBook', () => {
  let api: MockApi;

  afterEach(() => {
    api.restore();
  });

  it('loads the book and caches it under its key', async () => {
    api = mockApi({ [`GET /books/${ID}`]: { data: { data: book } } });
    const { wrapper, queryClient } = createQueryWrapper();

    const { result } = renderHook(() => useBook(ID), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(book));
    expect(queryClient.getQueryData(bookKey(ID))).toEqual(book);
  });

  it('exposes the ApiError of a missing book so the page can say so', async () => {
    api = mockApi({
      [`GET /books/${ID}`]: {
        status: 404,
        data: { message: 'Book not found' },
      },
    });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useBook(ID), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 404 });
  });

  it('marks the query silent: the page shows its own error', async () => {
    api = mockApi({ [`GET /books/${ID}`]: { data: { data: book } } });
    const { wrapper, queryClient } = createQueryWrapper();

    renderHook(() => useBook(ID), { wrapper });

    await waitFor(() =>
      expect(
        queryClient.getQueryCache().find({ queryKey: bookKey(ID) })?.meta,
      ).toEqual({ silent: true }),
    );
  });

  it('keys one book under ["books", id], inside the ["books"] family', () => {
    expect(bookKey(ID)).toEqual(['books', ID]);
  });
});
