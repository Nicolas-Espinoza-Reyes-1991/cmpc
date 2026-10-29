import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from './components/AppProviders';
import { apiClient, setUnauthorizedHandler } from './lib/api-client';
import { session } from './lib/session';
import { emptyCatalogs } from './test/catalog-routes';
import { mockApi, type MockApi } from './test/mock-api';
import {
  createAppRouter,
  registerUnauthorizedNavigation,
  routes,
} from './router';

const ADMIN = { id: 'id-admin', email: 'admin@cmpc.local' };
const EMPTY_LIST = {
  data: { data: [], meta: { page: 1, limit: 10, total: 0 } },
};

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

const heading = (name: string) => screen.findByRole('heading', { name });

describe('routes', () => {
  let api: MockApi;

  beforeEach(() => {
    localStorage.clear();
    // A saved token is valid for every test that sets one.
    // The books page asks for its list as soon as it opens.
    api = mockApi({
      ...emptyCatalogs,
      'GET /auth/me': { data: { data: ADMIN } },
      'GET /books': EMPTY_LIST,
    });
  });

  afterEach(() => {
    api.restore();
  });

  describe('protected /books', () => {
    it('sends a visitor without session to the login', async () => {
      const router = renderAt('/books');

      expect(await heading('Iniciar sesión')).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/login');
    });

    it('remembers where the visitor was going', async () => {
      const router = renderAt('/books');
      await heading('Iniciar sesión');

      expect(router.state.location.state).toEqual({ from: '/books' });
    });

    it('does not keep the blocked page in the history', async () => {
      const router = renderAt('/books');
      await heading('Iniciar sesión');

      // `replace` means "back" cannot return to the page that just redirected.
      expect(router.state.historyAction).toBe('REPLACE');
    });

    it('shows the page to a visitor whose session the server confirms', async () => {
      session.setToken('jwt-token');

      const router = renderAt('/books');

      expect(await heading('Libros')).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/books');
    });
  });

  describe('book form routes', () => {
    beforeEach(() => {
      api.restore();
      api = mockApi({
        ...emptyCatalogs,
        'GET /auth/me': { data: { data: ADMIN } },
        'GET /books/42': {
          data: {
            data: {
              id: '42',
              title: 'Dune',
              author: 'Frank Herbert',
              publisher: 'Ace',
              genre: 'Novela',
              price: 100,
              availability: true,
              imageUrl: null,
              createdAt: '2026-10-28T10:00:00.000Z',
              updatedAt: '2026-10-28T10:00:00.000Z',
            },
          },
        },
      });
    });

    it('opens /books/new inside the layout for a signed-in user', async () => {
      session.setToken('jwt-token');

      renderAt('/books/new');

      expect(await heading('Nuevo libro')).toBeInTheDocument();
      expect(screen.getByRole('banner')).toHaveTextContent(ADMIN.email);
    });

    it('opens /books/:id/edit inside the layout for a signed-in user', async () => {
      session.setToken('jwt-token');

      renderAt('/books/42/edit');

      expect(await heading('Editar libro')).toBeInTheDocument();
      expect(await screen.findByLabelText('Título')).toHaveValue('Dune');
    });

    it('opens /books/:id as the book detail inside the layout', async () => {
      session.setToken('jwt-token');

      renderAt('/books/42');

      expect(await heading('Dune')).toBeInTheDocument();
      expect(screen.getByRole('banner')).toHaveTextContent(ADMIN.email);
    });

    it.each(['/books/new', '/books/42/edit', '/books/42'])(
      'sends a visitor without session from %s to the login',
      async (path) => {
        const router = renderAt(path);

        expect(await heading('Iniciar sesión')).toBeInTheDocument();
        expect(router.state.location.state).toEqual({ from: path });
      },
    );
  });

  it('serves the login without a session', async () => {
    renderAt('/login');

    expect(await heading('Iniciar sesión')).toBeInTheDocument();
  });

  it('redirects the root to the books', async () => {
    session.setToken('jwt-token');

    const router = renderAt('/');

    expect(await heading('Libros')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/books');
  });

  it('shows a not found page with a way back', async () => {
    renderAt('/nowhere');

    expect(await heading('Página no encontrada')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Volver a los libros' }),
    ).toHaveAttribute('href', '/books');
  });
});

describe('createAppRouter', () => {
  it('builds a browser router with the application routes', () => {
    const router = createAppRouter();

    expect(router.routes).toHaveLength(routes.length);
    router.dispose();
  });
});

describe('registerUnauthorizedNavigation', () => {
  let api: MockApi;
  let expired: boolean;

  beforeEach(() => {
    localStorage.clear();
    expired = false;
    api = mockApi({
      ...emptyCatalogs,
      'GET /auth/me': { data: { data: ADMIN } },
      // The books page opens fine; the session expires only when the test says so.
      'GET /books': () => (expired ? { status: 401, data: {} } : EMPTY_LIST),
    });
  });

  afterEach(() => {
    setUnauthorizedHandler();
    api.restore();
  });

  it('moves to the login without a page reload when the session expires', async () => {
    session.setToken('expired-token');
    const router = renderAt('/books');
    registerUnauthorizedNavigation(router);
    expect(await heading('Libros')).toBeInTheDocument();
    expired = true;

    await apiClient.get('/books').catch(() => undefined);

    expect(session.getToken()).toBeNull();
    expect(await heading('Iniciar sesión')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });
});
