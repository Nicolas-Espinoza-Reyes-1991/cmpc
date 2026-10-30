import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createMemoryRouter,
  RouterProvider,
  type RouteObject,
} from 'react-router';
import { SERVER_FIELD_MESSAGE } from '../lib/api-error';
import { bookKey } from '../hooks/useBook';
import { listingView } from '../lib/listingView';
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
    listingView.clear();
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

    it('titles the tab «Nuevo libro · CMPC Libros»', () => {
      start();
      renderAt('/books/new');

      expect(document.title).toBe('Nuevo libro · CMPC Libros');
    });

    it('shows the empty form under the heading "Nuevo libro"', () => {
      start();
      renderAt('/books/new');

      expect(
        screen.getByRole('heading', { name: 'Nuevo libro' }),
      ).toBeInTheDocument();
      expect(field('Título')).toHaveValue('');
    });

    it('cancels back to the view of the list the user had', () => {
      listingView.save('?availability=true');
      start();
      renderAt('/books/new');

      expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute(
        'href',
        '/books?availability=true',
      );
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
        expect(field('Título')).toHaveAccessibleDescription(
          SERVER_FIELD_MESSAGE,
        ),
      );
    });
  });

  describe('the cover', () => {
    const png = () =>
      new File([new Uint8Array([1, 2, 3])], 'portada.png', {
        type: 'image/png',
      });
    const withCover = { ...book, imageUrl: '/api/uploads/new.png' };
    const choose = (file: File) =>
      userEvent
        .setup({ applyAccept: false })
        .upload(screen.getByLabelText('Portada (opcional)'), file);
    const posts = () => api.requests.filter((r) => r.method === 'post');
    const patches = () => api.requests.filter((r) => r.method === 'patch');
    const deletes = () => api.requests.filter((r) => r.method === 'delete');

    describe('creating a book', () => {
      async function fillAndChoose(file: File) {
        await userEvent.type(field('Título'), 'Dune');
        await userEvent.type(field('Autor'), 'Frank Herbert');
        await userEvent.type(field('Editorial'), 'Ace');
        await userEvent.type(field('Género'), 'Ciencia ficción');
        await userEvent.type(field('Precio'), '9990.5');
        await choose(file);
        await userEvent.click(
          screen.getByRole('button', { name: 'Registrar libro' }),
        );
      }

      it('creates the book first and uploads the cover after, then opens the detail', async () => {
        start({
          'POST /books': { status: 201, data: { data: book } },
          [`POST /books/${ID}/image`]: { data: { data: withCover } },
        });
        const { router, queryClient } = renderAt('/books/new');
        const file = png();

        await fillAndChoose(file);

        expect(
          await screen.findByText('detalle del libro'),
        ).toBeInTheDocument();
        expect(posts().map((r) => r.url)).toEqual([
          '/books',
          `/books/${ID}/image`,
        ]);
        const sent = (posts()[1]?.data as FormData).get('image') as File;
        expect(sent.name).toBe('portada.png');
        expect(router.state.location.pathname).toBe(`/books/${ID}`);
        expect(queryClient.getQueryData(bookKey(ID))).toEqual(withCover);
      });

      it('uploads nothing when no cover was chosen', async () => {
        start({ 'POST /books': { status: 201, data: { data: book } } });
        renderAt('/books/new');
        await userEvent.type(field('Título'), 'Dune');
        await userEvent.type(field('Autor'), 'Frank Herbert');
        await userEvent.type(field('Editorial'), 'Ace');
        await userEvent.type(field('Género'), 'Novela');
        await userEvent.type(field('Precio'), '100');

        await userEvent.click(
          screen.getByRole('button', { name: 'Registrar libro' }),
        );

        await screen.findByText('detalle del libro');
        expect(posts()).toHaveLength(1);
      });

      it('keeps the book and goes to its edit screen with a notice when the cover fails', async () => {
        start({
          'POST /books': { status: 201, data: { data: book } },
          [`POST /books/${ID}/image`]: { status: 413, data: {} },
          [`GET /books/${ID}`]: { data: { data: book } },
        });
        const { router, queryClient } = renderAt('/books/new');

        await fillAndChoose(png());

        expect(
          await screen.findByRole('heading', { name: 'Editar libro' }),
        ).toBeInTheDocument();
        expect(router.state.location.pathname).toBe(`/books/${ID}/edit`);
        expect(await screen.findByRole('alert')).toHaveTextContent(
          'El libro se guardó, pero la portada no se pudo subir:',
        );
        // The book was created once: no duplicate to fight with.
        expect(posts().filter((r) => r.url === '/books')).toHaveLength(1);
        expect(queryClient.getQueryData(bookKey(ID))).toEqual(book);
      });

      it('stays on the form when the book itself cannot be created, and uploads nothing', async () => {
        start({ 'POST /books': { status: 409, data: {} } });
        const { router } = renderAt('/books/new');

        await fillAndChoose(png());

        expect(await screen.findByRole('alert')).toHaveTextContent(
          'Ya existe un libro',
        );
        expect(router.state.location.pathname).toBe('/books/new');
        expect(posts()).toHaveLength(1);
      });
    });

    describe('when the server says the file is not an image', () => {
      it('explains it in words about the cover after creating the book', async () => {
        start({
          'POST /books': { status: 201, data: { data: book } },
          [`POST /books/${ID}/image`]: { status: 400, data: {} },
          [`GET /books/${ID}`]: { data: { data: book } },
        });
        renderAt('/books/new');
        await userEvent.type(field('Título'), 'Dune');
        await userEvent.type(field('Autor'), 'Frank Herbert');
        await userEvent.type(field('Editorial'), 'Ace');
        await userEvent.type(field('Género'), 'Novela');
        await userEvent.type(field('Precio'), '100');
        await choose(png());

        await userEvent.click(
          screen.getByRole('button', { name: 'Registrar libro' }),
        );

        expect(await screen.findByRole('alert')).toHaveTextContent(
          'El libro se guardó, pero la portada no se pudo subir: El archivo no es una imagen válida: usa un JPG, PNG o WebP.',
        );
      });

      it('says it when only the cover was sent while editing', async () => {
        start({
          [`GET /books/${ID}`]: { data: { data: book } },
          [`POST /books/${ID}/image`]: { status: 400, data: {} },
        });
        renderAt(`/books/${ID}/edit`);
        await screen.findByLabelText('Título');
        await choose(png());

        await userEvent.click(
          screen.getByRole('button', { name: 'Guardar cambios' }),
        );

        expect(await screen.findByRole('alert')).toHaveTextContent(
          'El archivo no es una imagen válida: usa un JPG, PNG o WebP.',
        );
      });

      it('says it after the data was saved while editing', async () => {
        start({
          [`GET /books/${ID}`]: { data: { data: book } },
          [`PATCH /books/${ID}`]: { data: { data: { ...book, price: 1 } } },
          [`POST /books/${ID}/image`]: { status: 400, data: {} },
        });
        renderAt(`/books/${ID}/edit`);
        await screen.findByLabelText('Título');
        await userEvent.clear(field('Precio'));
        await userEvent.type(field('Precio'), '1');
        await choose(png());

        await userEvent.click(
          screen.getByRole('button', { name: 'Guardar cambios' }),
        );

        expect(await screen.findByRole('alert')).toHaveTextContent(
          'Los datos se guardaron, pero la portada no se pudo actualizar: El archivo no es una imagen válida: usa un JPG, PNG o WebP.',
        );
      });
    });

    describe('editing a book', () => {
      const open = (extra: Record<string, MockRoute> = {}) => {
        start({ [`GET /books/${ID}`]: { data: { data: book } }, ...extra });
        return renderAt(`/books/${ID}/edit`);
      };

      it('shows the notice that a creation left, and the form', async () => {
        start({ [`GET /books/${ID}`]: { data: { data: book } } });
        const { wrapper } = createQueryWrapper();
        const router = createMemoryRouter(routes, {
          initialEntries: [
            {
              pathname: `/books/${ID}/edit`,
              state: { imageError: 'El archivo es muy grande.' },
            },
          ],
        });
        render(<RouterProvider router={router} />, { wrapper });

        expect(await screen.findByRole('alert')).toHaveTextContent(
          'El libro se guardó, pero la portada no se pudo subir: El archivo es muy grande.',
        );
        expect(field('Título')).toHaveValue('Dune');
      });

      it('ignores route state that is not a notice', async () => {
        start({ [`GET /books/${ID}`]: { data: { data: book } } });
        const { wrapper } = createQueryWrapper();
        const router = createMemoryRouter(routes, {
          initialEntries: [
            { pathname: `/books/${ID}/edit`, state: { imageError: 42 } },
          ],
        });
        render(<RouterProvider router={router} />, { wrapper });

        await screen.findByLabelText('Título');
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });

      it('shows the current cover of the book', async () => {
        open({ [`GET /books/${ID}`]: { data: { data: withCover } } });

        expect(
          await screen.findByRole('img', { name: 'Portada actual del libro' }),
        ).toHaveAttribute('src', '/api/uploads/new.png');
      });

      it('replaces only the cover: no PATCH when the data did not change', async () => {
        const { router, queryClient } = open({
          [`POST /books/${ID}/image`]: { data: { data: withCover } },
        });
        await screen.findByLabelText('Título');

        await choose(png());
        await userEvent.click(
          screen.getByRole('button', { name: 'Guardar cambios' }),
        );

        expect(
          await screen.findByText('detalle del libro'),
        ).toBeInTheDocument();
        expect(patches()).toHaveLength(0);
        expect(posts().map((r) => r.url)).toEqual([`/books/${ID}/image`]);
        expect(router.state.location.pathname).toBe(`/books/${ID}`);
        expect(queryClient.getQueryData(bookKey(ID))).toEqual(withCover);
      });

      it('saves the data first and the cover after when both changed', async () => {
        open({
          [`PATCH /books/${ID}`]: { data: { data: { ...book, price: 11000 } } },
          [`POST /books/${ID}/image`]: {
            data: { data: { ...withCover, price: 11000 } },
          },
        });
        await screen.findByLabelText('Título');

        await userEvent.clear(field('Precio'));
        await userEvent.type(field('Precio'), '11000');
        await choose(png());
        await userEvent.click(
          screen.getByRole('button', { name: 'Guardar cambios' }),
        );

        await screen.findByText('detalle del libro');
        const order = api.requests
          .filter((r) => r.method !== 'get')
          .map((r) => `${r.method} ${r.url}`);
        expect(order).toEqual([
          `patch /books/${ID}`,
          `post /books/${ID}/image`,
        ]);
      });

      it('removes the cover with the checkbox and sends no PATCH', async () => {
        const { queryClient } = open({
          [`GET /books/${ID}`]: { data: { data: withCover } },
          [`DELETE /books/${ID}/image`]: { data: { data: book } },
        });
        await screen.findByLabelText('Título');

        await userEvent.click(screen.getByLabelText('Quitar la imagen actual'));
        await userEvent.click(
          screen.getByRole('button', { name: 'Guardar cambios' }),
        );

        await screen.findByText('detalle del libro');
        expect(deletes()).toHaveLength(1);
        expect(patches()).toHaveLength(0);
        expect(queryClient.getQueryData(bookKey(ID))).toEqual(book);
      });

      it('shows the error and stays when only the cover fails', async () => {
        const { router } = open({
          [`POST /books/${ID}/image`]: { status: 413, data: {} },
        });
        await screen.findByLabelText('Título');

        await choose(png());
        await userEvent.click(
          screen.getByRole('button', { name: 'Guardar cambios' }),
        );

        expect(await screen.findByRole('alert')).toHaveTextContent(
          'demasiado grande',
        );
        expect(router.state.location.pathname).toBe(`/books/${ID}/edit`);
        expect(patches()).toHaveLength(0);
      });

      it('says the data was saved when the data went through but the cover failed', async () => {
        let attempts = 0;
        const { router, queryClient } = open({
          [`PATCH /books/${ID}`]: { data: { data: { ...book, price: 11000 } } },
          [`POST /books/${ID}/image`]: () => {
            attempts += 1;
            return attempts === 1
              ? { status: 500, data: {} }
              : { data: { data: { ...withCover, price: 11000 } } };
          },
        });
        await screen.findByLabelText('Título');
        await userEvent.clear(field('Precio'));
        await userEvent.type(field('Precio'), '11000');
        await choose(png());

        await userEvent.click(
          screen.getByRole('button', { name: 'Guardar cambios' }),
        );

        expect(await screen.findByRole('alert')).toHaveTextContent(
          'Los datos se guardaron, pero la portada no se pudo actualizar:',
        );
        expect(router.state.location.pathname).toBe(`/books/${ID}/edit`);
        expect(queryClient.getQueryData(bookKey(ID))).toMatchObject({
          price: 11000,
        });
        expect(field('Precio')).toHaveValue(11000);

        // Retrying sends only the cover: the data is already saved.
        await userEvent.click(
          screen.getByRole('button', { name: 'Guardar cambios' }),
        );

        expect(
          await screen.findByText('detalle del libro'),
        ).toBeInTheDocument();
        expect(patches()).toHaveLength(1);
        expect(posts()).toHaveLength(2);
      });
    });
  });

  describe('edit a book (/books/:id/edit)', () => {
    it('titles the tab «Editar libro · CMPC Libros»', async () => {
      start({ [`GET /books/${ID}`]: { data: { data: book } } });
      renderAt(`/books/${ID}/edit`);
      await screen.findByLabelText('Título');

      expect(document.title).toBe('Editar libro · CMPC Libros');
    });

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
