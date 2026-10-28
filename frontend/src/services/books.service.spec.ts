import { ApiError } from '../lib/api-error';
import { DEFAULT_PARAMS } from '../lib/book-list-params';
import { mockApi, type MockApi } from '../test/mock-api';
import type { Book, BookInput } from '../types/book';
import {
  createBook,
  deleteBook,
  getBook,
  deleteBookImage,
  listBooks,
  updateBook,
  uploadBookImage,
} from './books.service';

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

  describe('book image', () => {
    const withImage = { ...book, imageUrl: '/api/uploads/x.png' };
    const png = () =>
      new File([new Uint8Array([1, 2, 3])], 'portada.png', {
        type: 'image/png',
      });

    it('uploadBookImage posts the file as multipart in the field "image"', async () => {
      api = mockApi({
        [`POST /books/${ID}/image`]: { data: { data: withImage } },
      });
      const file = png();

      await expect(uploadBookImage(ID, file)).resolves.toEqual(withImage);

      const request = sent();
      expect(request?.method).toBe('post');
      expect(request?.data).toBeInstanceOf(FormData);
      const body = request?.data as FormData;
      expect([...body.keys()]).toEqual(['image']);
      const sentFile = body.get('image') as File;
      expect(sentFile.name).toBe('portada.png');
      expect(sentFile.type).toBe('image/png');
      expect(sentFile.size).toBe(3);
    });

    it('does not force a Content-Type: the browser must add the boundary', async () => {
      api = mockApi({
        [`POST /books/${ID}/image`]: { data: { data: withImage } },
      });

      await uploadBookImage(ID, png());

      const contentType = sent()?.headers.get('Content-Type');
      expect(String(contentType ?? '')).not.toContain('application/json');
    });

    it('encodes the id in the path', async () => {
      api = mockApi({
        'POST /books/..%2Fauth/image': { data: { data: withImage } },
      });

      await expect(uploadBookImage('../auth', png())).resolves.toEqual(
        withImage,
      );
    });

    it('deleteBookImage sends a DELETE and returns the book without a cover', async () => {
      api = mockApi({
        [`DELETE /books/${ID}/image`]: { data: { data: book } },
      });

      await expect(deleteBookImage(ID)).resolves.toEqual(book);

      expect(sent()?.method).toBe('delete');
    });

    it.each([
      ['uploadBookImage', () => uploadBookImage(ID, png())],
      ['deleteBookImage', () => deleteBookImage(ID)],
    ])(
      '%s rejects with an ApiError carrying the status',
      async (_name, call) => {
        api = mockApi({
          [`POST /books/${ID}/image`]: { status: 413, data: {} },
          [`DELETE /books/${ID}/image`]: { status: 404, data: {} },
        });

        await expect(call()).rejects.toBeInstanceOf(ApiError);
      },
    );

    it('uploadBookImage exposes the 413 of a file that is too large', async () => {
      api = mockApi({ [`POST /books/${ID}/image`]: { status: 413, data: {} } });

      await expect(uploadBookImage(ID, png())).rejects.toMatchObject({
        status: 413,
      });
    });
  });

  describe('listBooks', () => {
    it('reads one page and its totals from the API', async () => {
      api = mockApi({
        'GET /books': {
          data: { data: [book], meta: { page: 2, limit: 10, total: 11 } },
        },
      });

      await expect(listBooks({ ...DEFAULT_PARAMS, page: 2 })).resolves.toEqual({
        items: [book],
        meta: { page: 2, limit: 10, total: 11 },
      });
    });

    it('sends the view as query parameters and leaves out what is empty', async () => {
      api = mockApi({
        'GET /books': {
          data: { data: [], meta: { page: 1, limit: 10, total: 0 } },
        },
      });

      await listBooks({
        ...DEFAULT_PARAMS,
        search: 'dune',
        availability: false,
        sort: [{ field: 'price', direction: 'desc' }],
      });

      expect(sent()?.params).toMatchObject({
        page: 1,
        limit: 10,
        search: 'dune',
        availability: false,
        sort: 'price:desc',
        author: undefined,
      });
    });

    it('passes the cancellation signal to the request', async () => {
      api = mockApi({
        'GET /books': {
          data: { data: [], meta: { page: 1, limit: 10, total: 0 } },
        },
      });
      const controller = new AbortController();

      await listBooks(DEFAULT_PARAMS, controller.signal);

      expect(sent()?.signal).toBe(controller.signal);
    });

    it('builds the totals itself if the answer has none', async () => {
      api = mockApi({ 'GET /books': { data: { data: [book, book] } } });

      await expect(listBooks({ ...DEFAULT_PARAMS, page: 3 })).resolves.toEqual({
        items: [book, book],
        meta: { page: 3, limit: 10, total: 2 },
      });
    });

    it('rejects with an ApiError when the request fails', async () => {
      api = mockApi({ 'GET /books': { status: 500, data: {} } });

      await expect(listBooks(DEFAULT_PARAMS)).rejects.toMatchObject({
        status: 500,
      });
    });
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
