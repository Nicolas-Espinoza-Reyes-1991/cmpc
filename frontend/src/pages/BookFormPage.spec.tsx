import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createMemoryRouter,
  RouterProvider,
  type RouteObject,
} from 'react-router';
import { bookKey } from '../hooks/useBook';
import { emptyCatalogs } from '../test/catalog-routes';
import { mockApi, type MockApi, type MockRoute } from '../test/mock-api';
import { createQueryWrapper } from '../test/query-wrapper';
import type { Book } from '../types/book';
import { BookFormPage } from './BookFormPage';

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

const routes: RouteObject[] = [
  { path: '/books', element: <p>lista de libros</p> },
  { path: '/books/new', element: <BookFormPage /> },
  { path: '/books/:id', element: <p>detalle del libro</p> },
  { path: '/books/:id/edit', element: <BookFormPage /> },
];

function renderAt(path: string) {
  const { wrapper, queryClient } = createQueryWrapper();
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />, { wrapper });
  return { router, queryClient };
}

const field = (label: string) => screen.getByLabelText(label);
const sentBody = (api: MockApi, method: string) => {
  const request = api.requests.find((r) => r.method === method);
  return JSON.parse(String(request?.data)) as unknown;
};

describe('BookFormPage', () => {
  let api: MockApi;
  const start = (routesToMock: Record<string, MockRoute> = {}) => {
    api = mockApi({ ...emptyCatalogs, ...routesToMock });
  };

  afterEach(() => {
    api.restore();
  });

  describe('new book (/books/new)', () => {
    async function fillAndSubmit() {
      await userEvent.type(field('Título'), 'Dune');
      await userEvent.type(field('Autor'), 'Frank Herbert');
      await userEvent.type(field('Editorial'), 'Ace');
      await userEvent.type(field('Género'), 'Ciencia ficción');
      await userEvent.type(field('Precio'), '9990.5');
      await userEvent.click(
        screen.getByRole('button', { name: 'Registrar libro' }),
      );
    }

    it('shows the empty form under the heading "Nuevo libro"', () => {
      start();
      renderAt('/books/new');

      expect(
        screen.getByRole('heading', { name: 'Nuevo libro' }),
      ).toBeInTheDocument();
      expect(field('Título')).toHaveValue('');
    });

    it('creates the book, then opens its detail', async () => {
      start({ 'POST /books': { status: 201, data: { data: book } } });
      const { router } = renderAt('/books/new');

      await fillAndSubmit();

      expect(await screen.findByText('detalle del libro')).toBeInTheDocument();
      expect(router.state.location.pathname).toBe(`/books/${ID}`);
      expect(sentBody(api, 'post')).toEqual({
        title: 'Dune',
        author: 'Frank Herbert',
        publisher: 'Ace',
        genre: 'Ciencia ficción',
        price: 9990.5,
        availability: true,
      });
    });

    it('puts the saved book in the cache so the detail needs no new request', async () => {
      start({ 'POST /books': { status: 201, data: { data: book } } });
      const { queryClient } = renderAt('/books/new');

      await fillAndSubmit();

      await screen.findByText('detalle del libro');
      expect(queryClient.getQueryData(bookKey(ID))).toEqual(book);
    });

    it('marks the lists and the catalogs as stale, but not the book just saved', async () => {
      start({ 'POST /books': { status: 201, data: { data: book } } });
      const { queryClient } = renderAt('/books/new');
      // Queries nobody is watching, as the lists and catalogs will be after the save.
      const list = ['books', 'list', { page: 1 }];
      const other = ['books', 'other-id'];
      const catalog = ['catalog', 'genres', 'zzz'];
      for (const key of [list, other, catalog]) {
        queryClient.setQueryData(key, []);
      }

      await fillAndSubmit();

      await screen.findByText('detalle del libro');
      const invalidated = (key: unknown[]) =>
        queryClient.getQueryState(key)?.isInvalidated;
      expect(invalidated(list)).toBe(true);
      expect(invalidated(other)).toBe(true);
      expect(invalidated(catalog)).toBe(true);
      expect(invalidated([...bookKey(ID)])).toBe(false);
    });

    it('stays on the form and explains a duplicate book', async () => {
      start({ 'POST /books': { status: 409, data: {} } });
      const { router } = renderAt('/books/new');

      await fillAndSubmit();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Ya existe un libro con el mismo título, autor y editorial.',
      );
      expect(router.state.location.pathname).toBe('/books/new');
      expect(field('Título')).toHaveValue('Dune');
    });

    it('shows the field errors of a 400 on the form', async () => {
      start({
        'POST /books': {
          status: 400,
          data: {
            statusCode: 400,
            message: 'Validation failed',
            errors: [{ field: 'title', messages: ['title is taken'] }],
          },
        },
      });
      renderAt('/books/new');

      await fillAndSubmit();

      await waitFor(() =>
        expect(field('Título')).toHaveAccessibleDescription('title is taken'),
      );
    });
  });

  describe('edit a book (/books/:id/edit)', () => {
    it('shows a loading state while the book is read', async () => {
      let release: () => void = () => undefined;
      start({
        [`GET /books/${ID}`]: () =>
          new Promise((resolve) => {
            release = () => resolve({ data: { data: book } });
          }),
      });
      renderAt(`/books/${ID}/edit`);

      expect(await screen.findByRole('status')).toHaveTextContent(
        'Cargando libro…',
      );

      release();
      expect(await screen.findByLabelText('Título')).toBeInTheDocument();
    });

    it('fills the form with the saved book', async () => {
      start({ [`GET /books/${ID}`]: { data: { data: book } } });
      renderAt(`/books/${ID}/edit`);

      expect(await screen.findByLabelText('Título')).toHaveValue('Dune');
      expect(
        screen.getByRole('heading', { name: 'Editar libro' }),
      ).toBeInTheDocument();
      expect(field('Autor')).toHaveValue('Frank Herbert');
      expect(field('Precio')).toHaveValue(9990.5);
      expect(
        screen.getByRole('checkbox', { name: 'Disponible' }),
      ).toBeChecked();
      expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute(
        'href',
        `/books/${ID}`,
      );
    });

    it('sends only what changed, then opens the detail', async () => {
      start({
        [`GET /books/${ID}`]: { data: { data: book } },
        [`PATCH /books/${ID}`]: {
          data: { data: { ...book, price: 11000, genre: 'Novela' } },
        },
      });
      const { router, queryClient } = renderAt(`/books/${ID}/edit`);
      await screen.findByLabelText('Título');

      await userEvent.clear(field('Precio'));
      await userEvent.type(field('Precio'), '11000');
      await userEvent.clear(field('Género'));
      await userEvent.type(field('Género'), 'Novela');
      await userEvent.click(
        screen.getByRole('button', { name: 'Guardar cambios' }),
      );

      expect(await screen.findByText('detalle del libro')).toBeInTheDocument();
      expect(sentBody(api, 'patch')).toEqual({ price: 11000, genre: 'Novela' });
      expect(router.state.location.pathname).toBe(`/books/${ID}`);
      expect(queryClient.getQueryData(bookKey(ID))).toMatchObject({
        price: 11000,
      });
    });

    it('sends no request when nothing changed and just goes back to the detail', async () => {
      start({ [`GET /books/${ID}`]: { data: { data: book } } });
      renderAt(`/books/${ID}/edit`);
      await screen.findByLabelText('Título');

      await userEvent.click(
        screen.getByRole('button', { name: 'Guardar cambios' }),
      );

      expect(await screen.findByText('detalle del libro')).toBeInTheDocument();
      expect(api.requests.filter((r) => r.method === 'patch')).toHaveLength(0);
    });

    it('stays on the form when the new data duplicates another book', async () => {
      start({
        [`GET /books/${ID}`]: { data: { data: book } },
        [`PATCH /books/${ID}`]: { status: 409, data: {} },
      });
      const { router } = renderAt(`/books/${ID}/edit`);
      await screen.findByLabelText('Título');

      await userEvent.type(field('Título'), ' II');
      await userEvent.click(
        screen.getByRole('button', { name: 'Guardar cambios' }),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Ya existe un libro',
      );
      expect(router.state.location.pathname).toBe(`/books/${ID}/edit`);
    });

    it('says "Libro no encontrado" with a way back when the book does not exist', async () => {
      start({
        [`GET /books/${ID}`]: {
          status: 404,
          data: { message: 'Book not found' },
        },
      });
      renderAt(`/books/${ID}/edit`);

      expect(
        await screen.findByRole('heading', { name: 'Libro no encontrado' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'Volver a los libros' }),
      ).toHaveAttribute('href', '/books');
    });

    it('treats an id that is not a UUID (a 400 from the API) as a book that does not exist', async () => {
      start({
        [`GET /books/${ID}`]: {
          status: 400,
          data: { message: 'uuid is expected' },
        },
      });
      renderAt(`/books/${ID}/edit`);

      expect(
        await screen.findByRole('heading', { name: 'Libro no encontrado' }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    });

    it('offers to retry when the book cannot be read for another reason', async () => {
      let calls = 0;
      start({
        [`GET /books/${ID}`]: () => {
          calls += 1;
          return calls === 1
            ? { status: 500, data: {} }
            : { data: { data: book } };
        },
      });
      renderAt(`/books/${ID}/edit`);

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(await screen.findByLabelText('Título')).toHaveValue('Dune');
    });
  });
});
