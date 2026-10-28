import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from './components/AppProviders';
import { apiClient, setUnauthorizedHandler } from './lib/api-client';
import { session } from './lib/session';
import { mockApi, type MockApi } from './test/mock-api';
import {
  createAppRouter,
  registerUnauthorizedNavigation,
  routes,
} from './router';

const ADMIN = { id: 'id-admin', email: 'admin@cmpc.local' };

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
    api = mockApi({ 'GET /auth/me': { data: { data: ADMIN } } });
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

  beforeEach(() => {
    localStorage.clear();
    api = mockApi({
      'GET /auth/me': { data: { data: ADMIN } },
      'GET /books': { status: 401, data: {} },
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

    await apiClient.get('/books').catch(() => undefined);

    expect(session.getToken()).toBeNull();
    expect(await heading('Iniciar sesión')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });
});
