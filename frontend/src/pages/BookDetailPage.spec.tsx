import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createMemoryRouter,
  RouterProvider,
  type RouteObject,
} from 'react-router';
import { bookKey } from '../hooks/useBook';
import { mockApi, type MockApi, type MockRoute } from '../test/mock-api';
import { createQueryWrapper } from '../test/query-wrapper';
import type { Book } from '../types/book';
import { BookDetailPage } from './BookDetailPage';

const ID = '3f6c2a52-7f0e-4c3e-9d57-1d8f0f6a9b11';
const book: Book = {
  id: ID,
  title: 'Dune',
  author: 'Frank Herbert',
  publisher: 'Ace',
  genre: 'Ciencia ficción',
  price: 12990,
  availability: true,
  imageUrl: null,
  createdAt: '2026-10-28T10:00:00.000Z',
  updatedAt: '2026-10-29T11:30:00.000Z',
};

const routes: RouteObject[] = [
  { path: '/books', element: <p>lista de libros</p> },
  { path: '/books/:id', element: <BookDetailPage /> },
  { path: '/books/:id/edit', element: <p>formulario de edición</p> },
];

function renderAt(path = `/books/${ID}`) {
  const { wrapper, queryClient } = createQueryWrapper();
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />, { wrapper });
  return { router, queryClient };
}

const dialog = () => screen.queryByRole('dialog');

describe('BookDetailPage', () => {
  let api: MockApi;
  const start = (routesToMock: Record<string, MockRoute> = {}) => {
    api = mockApi({
      [`GET /books/${ID}`]: { data: { data: book } },
      ...routesToMock,
    });
  };

  afterEach(() => {
    api.restore();
  });

  describe('reading the book', () => {
    it('shows a loading state while the book is read', async () => {
      let release: () => void = () => undefined;
      start({
        [`GET /books/${ID}`]: () =>
          new Promise((resolve) => {
            release = () => resolve({ data: { data: book } });
          }),
      });
      renderAt();

      expect(await screen.findByRole('status')).toHaveTextContent(
        'Cargando libro…',
      );

      release();
      expect(
        await screen.findByRole('heading', { name: 'Dune' }),
      ).toBeInTheDocument();
    });

    it('shows every field of the book, formatted', async () => {
      start();
      renderAt();

      expect(
        await screen.findByRole('heading', { name: 'Dune' }),
      ).toBeInTheDocument();
      const definitions = [...document.querySelectorAll('dt')].map((term) => [
        term.textContent,
        term.nextElementSibling?.textContent?.replace(/\s/g, ' '),
      ]);
      expect(definitions).toEqual([
        ['Autor', 'Frank Herbert'],
        ['Editorial', 'Ace'],
        ['Género', 'Ciencia ficción'],
        ['Precio', '$12.990'],
        ['Disponibilidad', 'Disponible'],
        ['Registrado', expect.stringMatching(/^28-10-2026, /) as unknown],
        ['Última edición', expect.stringMatching(/^29-10-2026, /) as unknown],
      ]);
    });

    it('says "No disponible" for an unavailable book', async () => {
      start({
        [`GET /books/${ID}`]: {
          data: { data: { ...book, availability: false } },
        },
      });
      renderAt();

      expect(await screen.findByText('No disponible')).toBeInTheDocument();
      expect(screen.queryByText('Disponible')).not.toBeInTheDocument();
    });

    it('shows the cover when the book has one', async () => {
      start({
        [`GET /books/${ID}`]: {
          data: { data: { ...book, imageUrl: '/uploads/dune.png' } },
        },
      });
      renderAt();

      const cover = await screen.findByRole('img', { name: 'Portada de Dune' });
      expect(cover).toHaveAttribute('src', '/uploads/dune.png');
      expect(cover).toHaveAttribute('loading', 'lazy');
      expect(cover).toHaveAttribute('decoding', 'async');
    });

    it('offers the cover as a download only when there is one', async () => {
      start({
        [`GET /books/${ID}`]: {
          data: { data: { ...book, imageUrl: '/api/uploads/dune.png' } },
        },
      });
      renderAt();

      expect(
        await screen.findByRole('link', { name: 'Descargar portada' }),
      ).toHaveAttribute('download', 'dune.png');
    });

    it('does not offer a download when the book has no cover', async () => {
      start();
      renderAt();

      expect(
        await screen.findByRole('heading', { name: 'Dune' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: 'Descargar portada' }),
      ).not.toBeInTheDocument();
    });

    it('hides the download when the cover file cannot be loaded', async () => {
      start({
        [`GET /books/${ID}`]: {
          data: { data: { ...book, imageUrl: '/uploads/roto.png' } },
        },
      });
      renderAt();

      fireEvent.error(
        await screen.findByRole('img', { name: 'Portada de Dune' }),
      );

      expect(
        screen.queryByRole('link', { name: 'Descargar portada' }),
      ).not.toBeInTheDocument();
    });

    it('lists the actions in one order, the same on phones and on desktop', async () => {
      start({
        [`GET /books/${ID}`]: {
          data: { data: { ...book, imageUrl: '/api/uploads/dune.png' } },
        },
      });
      renderAt();
      await screen.findByRole('heading', { name: 'Dune' });

      // The thumbnail button and the dialogs' buttons are not page actions.
      const actions = [
        ...document.querySelectorAll('main a[href], main button'),
      ]
        .filter(
          (element) =>
            !element.closest('dialog') && !element.hasAttribute('aria-label'),
        )
        .map((element) => element.textContent?.trim());
      expect(actions).toEqual([
        'Editar',
        'Descargar portada',
        'Eliminar',
        'Volver a los libros',
      ]);
    });

    it('shows a placeholder when the cover file cannot be loaded', async () => {
      start({
        [`GET /books/${ID}`]: {
          data: { data: { ...book, imageUrl: '/uploads/roto.png' } },
        },
      });
      renderAt();

      fireEvent.error(
        await screen.findByRole('img', { name: 'Portada de Dune' }),
      );

      expect(
        screen.getByRole('img', { name: 'La portada no se pudo cargar' }),
      ).toHaveTextContent('Sin portada');
      expect(
        screen.queryByRole('img', { name: 'Portada de Dune' }),
      ).not.toBeInTheDocument();
    });

    it('shows a placeholder when the book has no cover', async () => {
      start();
      renderAt();

      expect(
        await screen.findByRole('img', {
          name: 'Este libro todavía no tiene portada',
        }),
      ).toHaveTextContent('Sin portada');
    });

    it('offers to edit it, and to go back to the books', async () => {
      start();
      renderAt();

      expect(
        await screen.findByRole('link', { name: 'Editar' }),
      ).toHaveAttribute('href', `/books/${ID}/edit`);
      expect(
        screen.getByRole('link', { name: 'Volver a los libros' }),
      ).toHaveAttribute('href', '/books');
    });

    it.each([
      ['does not exist', 404],
      ['has an id that is not a UUID', 400],
    ])(
      'says "Libro no encontrado" when the book %s',
      async (_label, status) => {
        start({
          [`GET /books/${ID}`]: { status, data: { message: 'nope' } },
        });
        renderAt();

        expect(
          await screen.findByRole('heading', { name: 'Libro no encontrado' }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole('link', { name: 'Volver a los libros' }),
        ).toHaveAttribute('href', '/books');
      },
    );

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
      renderAt();

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(
        await screen.findByRole('heading', { name: 'Dune' }),
      ).toBeInTheDocument();
    });
  });

  it('says "Libro no encontrado" when the route has no book id', () => {
    start();
    const { wrapper } = createQueryWrapper();
    const router = createMemoryRouter(
      [{ path: '/books/sin-id', element: <BookDetailPage /> }],
      { initialEntries: ['/books/sin-id'] },
    );
    render(<RouterProvider router={router} />, { wrapper });

    expect(
      screen.getByRole('heading', { name: 'Libro no encontrado' }),
    ).toBeInTheDocument();
    expect(api.requests).toHaveLength(0);
  });

  describe('deleting the book', () => {
    async function openDialog() {
      await userEvent.click(
        await screen.findByRole('button', { name: 'Eliminar' }),
      );
    }

    it('asks first, naming the book, and sends nothing yet', async () => {
      start();
      renderAt();

      expect(dialog()).not.toBeInTheDocument();
      await openDialog();

      const confirmation = screen.getByRole('dialog', {
        name: 'Eliminar libro',
      });
      expect(confirmation).toHaveAccessibleDescription(
        '¿Eliminar «Dune»? Dejará de aparecer en el listado.',
      );
      expect(api.requests.filter((r) => r.method === 'delete')).toHaveLength(0);
    });

    it('does nothing when the user cancels with the button', async () => {
      start();
      const { router } = renderAt();
      await openDialog();

      await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

      expect(dialog()).not.toBeInTheDocument();
      expect(api.requests.filter((r) => r.method === 'delete')).toHaveLength(0);
      expect(router.state.location.pathname).toBe(`/books/${ID}`);
    });

    it('does nothing when the user cancels with Escape', async () => {
      start();
      renderAt();
      await openDialog();

      fireEvent(
        screen.getByRole('dialog'),
        new Event('cancel', { cancelable: true }),
      );

      await waitFor(() => expect(dialog()).not.toBeInTheDocument());
      expect(api.requests.filter((r) => r.method === 'delete')).toHaveLength(0);
    });

    it('deletes the book, forgets it and goes back to the list', async () => {
      start({ [`DELETE /books/${ID}`]: { status: 204 } });
      const { router, queryClient } = renderAt();
      queryClient.setQueryData(['books', 'list', { page: 1 }], []);
      await openDialog();

      await userEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Eliminar',
        }),
      );

      expect(await screen.findByText('lista de libros')).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/books');
      expect(api.requests.filter((r) => r.method === 'delete')).toHaveLength(1);
      expect(queryClient.getQueryData(bookKey(ID))).toBeUndefined();
      expect(
        queryClient.getQueryState(['books', 'list', { page: 1 }])
          ?.isInvalidated,
      ).toBe(true);
    });

    it('shows "Eliminando…" and sends one request even if the user clicks twice', async () => {
      let finish: () => void = () => undefined;
      start({
        [`DELETE /books/${ID}`]: () =>
          new Promise((resolve) => {
            finish = () => resolve({ status: 204 });
          }),
      });
      renderAt();
      await openDialog();

      await userEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Eliminar',
        }),
      );
      const busy = await screen.findByRole('button', { name: 'Eliminando…' });
      await userEvent.click(busy);

      expect(api.requests.filter((r) => r.method === 'delete')).toHaveLength(1);

      finish();
      expect(await screen.findByText('lista de libros')).toBeInTheDocument();
    });

    it('shows the error inside the dialog, stays on the book and allows trying again', async () => {
      let calls = 0;
      start({
        [`DELETE /books/${ID}`]: () => {
          calls += 1;
          return calls === 1 ? { status: 500, data: {} } : { status: 204 };
        },
      });
      const { router } = renderAt();
      await openDialog();
      const confirm = () =>
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Eliminar',
        });

      await userEvent.click(confirm());

      expect(
        await within(screen.getByRole('dialog')).findByRole('alert'),
      ).toBeInTheDocument();
      expect(router.state.location.pathname).toBe(`/books/${ID}`);
      expect(confirm()).toBeEnabled();

      await userEvent.click(confirm());

      expect(await screen.findByText('lista de libros')).toBeInTheDocument();
    });

    it('clears an old error when the dialog is closed and opened again', async () => {
      start({ [`DELETE /books/${ID}`]: { status: 500, data: {} } });
      renderAt();
      await openDialog();
      await userEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Eliminar',
        }),
      );
      await within(screen.getByRole('dialog')).findByRole('alert');

      await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      await openDialog();

      expect(
        within(screen.getByRole('dialog')).queryByRole('alert'),
      ).not.toBeInTheDocument();
    });
  });
});
