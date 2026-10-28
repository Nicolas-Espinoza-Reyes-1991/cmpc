import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createMemoryRouter,
  RouterProvider,
  type RouteObject,
} from 'react-router';
import { emptyCatalogs } from '../test/catalog-routes';
import { mockApi, type MockApi, type MockReply } from '../test/mock-api';
import { createQueryWrapper } from '../test/query-wrapper';
import type { Book } from '../types/book';
import { BooksPage } from './BooksPage';

const book = (n: number, overrides: Partial<Book> = {}): Book => ({
  id: `id-${n}`,
  title: `Libro ${n}`,
  author: `Autor ${n}`,
  publisher: 'Editorial',
  genre: 'Novela',
  price: 1000 * n,
  availability: n % 2 === 0,
  imageUrl: null,
  createdAt: '2026-10-28T10:00:00.000Z',
  updatedAt: '2026-10-28T10:00:00.000Z',
  ...overrides,
});

const page = (
  books: Book[],
  meta: { page?: number; limit?: number; total?: number } = {},
): MockReply => ({
  data: {
    data: books,
    meta: {
      page: meta.page ?? 1,
      limit: meta.limit ?? 10,
      total: meta.total ?? books.length,
    },
  },
});

const routes: RouteObject[] = [
  { path: '/books', element: <BooksPage /> },
  { path: '/books/new', element: <p>formulario</p> },
  { path: '/books/:id', element: <p>detalle</p> },
];

/** Real timers: the typing pause is 300 ms. */
const PAUSE = { timeout: 2000 };

describe('BooksPage', () => {
  let api: MockApi;
  const listRequests = () => api.requests.filter((r) => r.url === '/books');
  const lastQuery = () =>
    listRequests().at(-1)?.params as Record<string, unknown>;

  function start(
    list:
      | MockReply
      | ((params: Record<string, unknown>) => MockReply | Promise<MockReply>),
    url = '/books',
  ) {
    api = mockApi({
      ...emptyCatalogs,
      'GET /books': (config) =>
        typeof list === 'function'
          ? list(config.params as Record<string, unknown>)
          : list,
    });
    const { wrapper } = createQueryWrapper();
    const router = createMemoryRouter(routes, { initialEntries: [url] });
    render(<RouterProvider router={router} />, { wrapper });
    return router;
  }

  afterEach(() => {
    api.restore();
  });

  describe('the list', () => {
    it('shows a loading state, then the books and how many there are', async () => {
      let release: () => void = () => undefined;
      start(
        () =>
          new Promise((resolve) => {
            release = () =>
              resolve(page([book(1), book(2), book(3)], { total: 3 }));
          }),
      );

      expect(await screen.findByText('Cargando libros…')).toBeInTheDocument();
      release();

      expect(await screen.findByText('3 resultados')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Libro 2' })).toHaveAttribute(
        'href',
        '/books/id-2',
      );
    });

    it('asks for the first page of 10, newest first, without filters', async () => {
      start(page([book(1)]));

      await screen.findByText('1 resultado');

      expect(listRequests()).toHaveLength(1);
      expect(lastQuery()).toMatchObject({ page: 1, limit: 10 });
      expect(lastQuery()).toMatchObject({
        search: undefined,
        author: undefined,
        availability: undefined,
        sort: undefined,
      });
    });

    it('says "1 resultado" in the singular', async () => {
      start(page([book(1)]));

      expect(await screen.findByText('1 resultado')).toBeInTheDocument();
    });

    it('keeps the way into the new book form', async () => {
      start(page([book(1)]));

      expect(
        await screen.findByRole('link', { name: 'Nuevo libro' }),
      ).toHaveAttribute('href', '/books/new');
    });
  });

  describe('search by title', () => {
    it('asks the server once, after the user pauses, and goes back to page 1', async () => {
      const router = start(page([book(1)], { total: 25 }), '/books?page=3');
      await screen.findByText('25 resultados');
      expect(listRequests()).toHaveLength(1);

      await userEvent.type(screen.getByLabelText('Buscar por título'), 'dune');

      expect(listRequests()).toHaveLength(1);
      await waitFor(
        () => expect(lastQuery()).toMatchObject({ search: 'dune', page: 1 }),
        PAUSE,
      );
      expect(listRequests()).toHaveLength(2);
      expect(router.state.location.search).toBe('?q=dune');
    });

    it('writes the search in the URL without adding history entries per pause', async () => {
      const router = start(page([book(1)]));
      await screen.findByText('1 resultado');

      await userEvent.type(screen.getByLabelText('Buscar por título'), 'dune');
      await waitFor(
        () => expect(router.state.location.search).toBe('?q=dune'),
        PAUSE,
      );

      expect(router.state.historyAction).toBe('REPLACE');
    });

    it('opens with the search of the URL already in the box and in the request', async () => {
      start(page([book(1)]), '/books?q=dune');

      await screen.findByText('1 resultado');

      expect(screen.getByLabelText('Buscar por título')).toHaveValue('dune');
      expect(lastQuery()).toMatchObject({ search: 'dune' });
    });
  });

  describe('filters', () => {
    it.each([
      ['Autor', 'author', 'herbert'],
      ['Editorial', 'publisher', 'ace'],
      ['Género', 'genre', 'ficción'],
    ])('filters by %s', async (label, key, text) => {
      start(page([book(1)]));
      await screen.findByText('1 resultado');

      await userEvent.type(screen.getByLabelText(label), text);

      await waitFor(
        () => expect(lastQuery()).toMatchObject({ [key]: text }),
        PAUSE,
      );
    });

    it('filters by availability at once', async () => {
      start(page([book(1)]));
      await screen.findByText('1 resultado');

      await userEvent.selectOptions(
        screen.getByLabelText('Disponibilidad'),
        'Disponibles',
      );

      await waitFor(() =>
        expect(lastQuery()).toMatchObject({ availability: true }),
      );
    });

    it('combines every filter in one request', async () => {
      start(page([book(1)]));
      await screen.findByText('1 resultado');

      await userEvent.type(screen.getByLabelText('Buscar por título'), 'dune');
      await userEvent.type(screen.getByLabelText('Autor'), 'herb');
      await userEvent.selectOptions(
        screen.getByLabelText('Disponibilidad'),
        'No disponibles',
      );

      await waitFor(
        () =>
          expect(lastQuery()).toMatchObject({
            search: 'dune',
            author: 'herb',
            availability: false,
          }),
        PAUSE,
      );
    });

    it('goes back to page 1 when a filter changes', async () => {
      start(page([book(1)], { total: 50 }), '/books?page=4');
      await screen.findByText('50 resultados');

      await userEvent.selectOptions(
        screen.getByLabelText('Disponibilidad'),
        'Disponibles',
      );

      await waitFor(() =>
        expect(lastQuery()).toMatchObject({ availability: true, page: 1 }),
      );
    });

    it('clears every filter and keeps the order', async () => {
      start(
        page([book(1)]),
        '/books?q=dune&author=herb&availability=true&sort=price:desc',
      );
      await screen.findByText('1 resultado');

      await userEvent.click(
        screen.getByRole('button', { name: 'Limpiar filtros' }),
      );

      await waitFor(() =>
        expect(lastQuery()).toMatchObject({
          search: undefined,
          author: undefined,
          availability: undefined,
          sort: 'price:desc',
        }),
      );
      expect(screen.getByLabelText('Buscar por título')).toHaveValue('');
      expect(screen.getByLabelText('Autor')).toHaveValue('');
      expect(
        screen.queryByRole('button', { name: 'Limpiar filtros' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('sorting', () => {
    const header = (name: string) =>
      screen.getByRole('columnheader', { name: new RegExp(`^${name}`) });
    const press = (name: string) =>
      userEvent.click(
        screen.getByRole('button', { name: new RegExp(`^${name}`) }),
      );

    it('orders ascending, then descending, then off', async () => {
      start(page([book(1)]));
      await screen.findByText('1 resultado');

      await press('Precio');
      await waitFor(() =>
        expect(lastQuery()).toMatchObject({ sort: 'price:asc' }),
      );
      expect(header('Precio')).toHaveAttribute('aria-sort', 'ascending');

      await press('Precio');
      await waitFor(() =>
        expect(lastQuery()).toMatchObject({ sort: 'price:desc' }),
      );
      expect(header('Precio')).toHaveAttribute('aria-sort', 'descending');

      await press('Precio');
      await waitFor(() =>
        expect(lastQuery()).toMatchObject({ sort: undefined }),
      );
      expect(header('Precio')).toHaveAttribute('aria-sort', 'none');
    });

    it('orders by several columns, in the order they were pressed', async () => {
      start(page([book(1)]));
      await screen.findByText('1 resultado');

      await press('Género');
      await press('Precio');
      await press('Precio');

      await waitFor(() =>
        expect(lastQuery()).toMatchObject({ sort: 'genre:asc,price:desc' }),
      );
      expect(header('Género').querySelector('sup')).toHaveTextContent('1');
      expect(header('Precio').querySelector('sup')).toHaveTextContent('2');
    });

    it('goes back to page 1 when the order changes', async () => {
      start(page([book(1)], { total: 50 }), '/books?page=3');
      await screen.findByText('50 resultados');

      await press('Título');

      await waitFor(() =>
        expect(lastQuery()).toMatchObject({ sort: 'title:asc', page: 1 }),
      );
    });

    it('removes the whole order with "Quitar orden"', async () => {
      start(page([book(1)]), '/books?sort=genre:asc,price:desc');
      await screen.findByText('1 resultado');

      await userEvent.click(
        screen.getByRole('button', { name: 'Quitar orden' }),
      );

      await waitFor(() =>
        expect(lastQuery()).toMatchObject({ sort: undefined }),
      );
      expect(
        screen.queryByRole('button', { name: 'Quitar orden' }),
      ).not.toBeInTheDocument();
    });

    it('does not offer "Quitar orden" when there is no order', async () => {
      start(page([book(1)]));
      await screen.findByText('1 resultado');

      expect(
        screen.queryByRole('button', { name: 'Quitar orden' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('pagination', () => {
    const books = Array.from({ length: 10 }, (_, i) => book(i + 1));

    it('shows where the user is and moves between pages', async () => {
      start((params) => page(books, { page: Number(params.page), total: 25 }));
      expect(await screen.findByText('Página 1 de 3')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();

      await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

      expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument();
      expect(lastQuery()).toMatchObject({ page: 2 });

      await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
      expect(await screen.findByText('Página 3 de 3')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();

      await userEvent.click(screen.getByRole('button', { name: 'Anterior' }));
      expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument();
    });

    it('changes the page size and goes back to page 1', async () => {
      start(
        (params) => page(books, { page: Number(params.page), total: 25 }),
        '/books?page=2',
      );
      await screen.findByText('Página 2 de 3');

      await userEvent.selectOptions(
        screen.getByRole('combobox', { name: 'Libros por página' }),
        '20',
      );

      await waitFor(() =>
        expect(lastQuery()).toMatchObject({ limit: 20, page: 1 }),
      );
      expect(await screen.findByText('Página 1 de 2')).toBeInTheDocument();
    });

    it('keeps the previous page on screen, dimmed, while the next one loads', async () => {
      let release: () => void = () => undefined;
      api = mockApi({
        ...emptyCatalogs,
        'GET /books': (config) => {
          const { page: number } = config.params as { page: number };
          if (number === 1) return page(books, { total: 25 });
          return new Promise((resolve) => {
            release = () => resolve(page([book(11)], { page: 2, total: 25 }));
          });
        },
      });
      const { wrapper } = createQueryWrapper();
      render(
        <RouterProvider
          router={createMemoryRouter(routes, { initialEntries: ['/books'] })}
        />,
        { wrapper },
      );
      await screen.findByText('Página 1 de 3');

      await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

      await waitFor(() =>
        expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true'),
      );
      expect(screen.getByRole('link', { name: 'Libro 1' })).toBeInTheDocument();

      release();
      expect(
        await screen.findByRole('link', { name: 'Libro 11' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'false');
    });

    it('goes to the last page when the URL asks for one that does not exist', async () => {
      const router = start((params) => {
        const number = Number(params.page);
        return number > 3
          ? page([], { page: number, total: 25 })
          : page(books, { page: number, total: 25 });
      }, '/books?page=9');

      expect(await screen.findByText('Página 3 de 3')).toBeInTheDocument();
      expect(router.state.location.search).toBe('?page=3');
    });

    it('goes to page 1 when a search leaves no results on a far page', async () => {
      const router = start(
        (params) =>
          Number(params.page) > 1
            ? page([], { page: Number(params.page), total: 0 })
            : page([], { total: 0 }),
        '/books?page=4',
      );

      expect(await screen.findByText('0 resultados')).toBeInTheDocument();
      await waitFor(() => expect(router.state.location.search).toBe(''));
    });
  });

  describe('the view lives in the URL', () => {
    it('reads search, filters, order, page and size from the link', async () => {
      start(
        page([book(1)], { page: 2, limit: 20, total: 45 }),
        '/books?q=dune&author=herb&publisher=ace&genre=novela&availability=false&sort=price:desc&page=2&limit=20',
      );

      await screen.findByText('45 resultados');

      expect(lastQuery()).toMatchObject({
        search: 'dune',
        author: 'herb',
        publisher: 'ace',
        genre: 'novela',
        availability: false,
        sort: 'price:desc',
        page: 2,
        limit: 20,
      });
      expect(screen.getByLabelText('Disponibilidad')).toHaveValue('false');
      expect(
        screen.getByRole('columnheader', { name: /^Precio/ }),
      ).toHaveAttribute('aria-sort', 'descending');
      expect(screen.getByText('Página 2 de 3')).toBeInTheDocument();
      expect(
        screen.getByRole('combobox', { name: 'Libros por página' }),
      ).toHaveValue('20');
    });

    it('ignores invalid values of the link and shows the default view', async () => {
      start(
        page([book(1)]),
        '/books?page=0&limit=7&sort=foo:asc&availability=maybe',
      );

      await screen.findByText('1 resultado');

      expect(lastQuery()).toMatchObject({
        page: 1,
        limit: 10,
        sort: undefined,
        availability: undefined,
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('returns to the previous view with the Back button', async () => {
      const router = start(page([book(1)]));
      await screen.findByText('1 resultado');
      await userEvent.click(screen.getByRole('button', { name: /^Precio/ }));
      await waitFor(() =>
        expect(lastQuery()).toMatchObject({ sort: 'price:asc' }),
      );

      await router.navigate(-1);

      await waitFor(() =>
        expect(lastQuery()).toMatchObject({ sort: undefined }),
      );
      expect(
        screen.getByRole('columnheader', { name: /^Precio/ }),
      ).toHaveAttribute('aria-sort', 'none');
    });
  });

  describe('without results', () => {
    it('invites to register the first book when there are no books at all', async () => {
      start(page([], { total: 0 }));

      expect(
        await screen.findByText('No hay libros todavía.'),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'Registrar el primer libro' }),
      ).toHaveAttribute('href', '/books/new');
      expect(screen.getByText('0 resultados')).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('says no book matches the filters and keeps the way to clear them', async () => {
      start(page([], { total: 0 }), '/books?q=nada');

      expect(
        await screen.findByText(/Ningún libro coincide con los filtros/),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Limpiar filtros' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByText('No hay libros todavía.'),
      ).not.toBeInTheDocument();
    });
  });

  describe('when the list cannot be read', () => {
    it('shows the error with a retry and recovers', async () => {
      let calls = 0;
      start(() => {
        calls += 1;
        return calls === 1 ? { status: 500, data: {} } : page([book(1)]);
      });

      const alert = await screen.findByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(screen.queryByText('Cargando libros…')).not.toBeInTheDocument();

      await userEvent.click(
        within(alert).getByRole('button', { name: 'Reintentar' }),
      );

      expect(await screen.findByText('1 resultado')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
