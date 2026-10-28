import { ApiError } from '../lib/api-error';
import { mockApi, type MockApi } from '../test/mock-api';
import type { Book, BookInput } from '../types/book';
import { createBook, deleteBook, getBook, updateBook } from './books.service';

const ID = '3f6c2a52-7f0e-4c3e-9d57-1d8f0f6a9b11';
const book: Book = {
  id: ID,
  title: 'Dune',
  author: 'Frank Herbert',
  publisher: 'Ace',
  genre: 'Ciencia ficción',
  price: 9990.5,
  availability: true,
  imageUrl: null,
  createdAt: '2026-10-28T10:00:00.000Z',
  updatedAt: '2026-10-28T10:00:00.000Z',
};
const input: BookInput = {
  title: 'Dune',
  author: 'Frank Herbert',
  publisher: 'Ace',
  genre: 'Ciencia ficción',
  price: 9990.5,
  availability: true,
};

describe('books service', () => {
  let api: MockApi;
  const sent = () => api.requests[0];
  const body = () => JSON.parse(String(sent()?.data)) as unknown;

  afterEach(() => {
    api.restore();
  });

  it('createBook posts the input and unwraps the book', async () => {
    api = mockApi({ 'POST /books': { status: 201, data: { data: book } } });

    await expect(createBook(input)).resolves.toEqual(book);

    expect(sent()?.method).toBe('post');
    expect(body()).toEqual(input);
  });

  it('getBook reads one book by id', async () => {
    api = mockApi({ [`GET /books/${ID}`]: { data: { data: book } } });

    await expect(getBook(ID)).resolves.toEqual(book);
  });

  it('getBook passes the cancellation signal to the request', async () => {
    api = mockApi({ [`GET /books/${ID}`]: { data: { data: book } } });
    const controller = new AbortController();

    await getBook(ID, controller.signal);

    expect(sent()?.signal).toBe(controller.signal);
  });

  it('encodes the id so it cannot change the path', async () => {
    api = mockApi({ 'GET /books/..%2Fauth%2Fme': { data: { data: book } } });

    await expect(getBook('../auth/me')).resolves.toEqual(book);
  });

  it('updateBook patches only the changes it is given', async () => {
    api = mockApi({
      [`PATCH /books/${ID}`]: { data: { data: { ...book, price: 11000 } } },
    });

    const updated = await updateBook(ID, { price: 11000 });

    expect(updated.price).toBe(11000);
    expect(sent()?.method).toBe('patch');
    expect(body()).toEqual({ price: 11000 });
  });

  it('deleteBook sends a DELETE and resolves with nothing', async () => {
    api = mockApi({ [`DELETE /books/${ID}`]: { status: 204 } });

    await expect(deleteBook(ID)).resolves.toBeUndefined();

    expect(sent()?.method).toBe('delete');
  });

  it.each([
    ['getBook', () => getBook(ID)],
    ['updateBook', () => updateBook(ID, { title: 'x' })],
    ['deleteBook', () => deleteBook(ID)],
  ])('%s rejects with an ApiError carrying the status', async (_name, call) => {
    api = mockApi({
      [`GET /books/${ID}`]: {
        status: 404,
        data: { message: 'Book not found' },
      },
      [`PATCH /books/${ID}`]: {
        status: 404,
        data: { message: 'Book not found' },
      },
      [`DELETE /books/${ID}`]: {
        status: 404,
        data: { message: 'Book not found' },
      },
    });

    const failure = call();

    await expect(failure).rejects.toBeInstanceOf(ApiError);
    await expect(failure).rejects.toMatchObject({ status: 404 });
  });

  it('createBook exposes the per-field errors of a 400', async () => {
    api = mockApi({
      'POST /books': {
        status: 400,
        data: {
          statusCode: 400,
          message: 'Validation failed',
          errors: [{ field: 'title', messages: ['title should not be empty'] }],
        },
      },
    });

    await expect(createBook(input)).rejects.toMatchObject({
      status: 400,
      fieldErrors: [
        { field: 'title', messages: ['title should not be empty'] },
      ],
    });
  });
});
