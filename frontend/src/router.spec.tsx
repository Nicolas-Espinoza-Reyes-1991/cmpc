import { act, render, screen } from '@testing-library/react';
import { AxiosError, type AxiosAdapter } from 'axios';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { apiClient, setUnauthorizedHandler } from './lib/api-client';
import { session } from './lib/session';
import {
  createAppRouter,
  registerUnauthorizedNavigation,
  routes,
} from './router';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const heading = (name: string) => screen.getByRole('heading', { name });

describe('routes', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('protected /books', () => {
    it('sends a visitor without session to the login', () => {
      const router = renderAt('/books');

      expect(heading('Iniciar sesión')).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/login');
    });

    it('remembers where the visitor was going', () => {
      const router = renderAt('/books');

      expect(router.state.location.state).toEqual({ from: '/books' });
    });

    it('does not keep the blocked page in the history', () => {
      const router = renderAt('/books');

      // `replace` means "back" cannot return to the page that just redirected.
      expect(router.state.historyAction).toBe('REPLACE');
    });

    it('shows the page to a visitor with a session', () => {
      session.setToken('jwt-token');

      const router = renderAt('/books');

      expect(heading('Libros')).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/books');
    });
  });

  it('serves the login without a session', () => {
    renderAt('/login');

    expect(heading('Iniciar sesión')).toBeInTheDocument();
  });

  it('redirects the root to the books', () => {
    session.setToken('jwt-token');

    const router = renderAt('/');

    expect(router.state.location.pathname).toBe('/books');
    expect(heading('Libros')).toBeInTheDocument();
  });

  it('shows a not found page with a way back', () => {
    renderAt('/nowhere');

    expect(heading('Página no encontrada')).toBeInTheDocument();
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
  const originalAdapter = apiClient.defaults.adapter;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    setUnauthorizedHandler();
    apiClient.defaults.adapter = originalAdapter;
  });

  it('moves to the login without a page reload when the session expires', async () => {
    session.setToken('expired-token');
    const router = renderAt('/books');
    registerUnauthorizedNavigation(router);
    const adapter: AxiosAdapter = (config) =>
      Promise.reject(
        new AxiosError(
          'Unauthorized',
          AxiosError.ERR_BAD_REQUEST,
          config,
          null,
          {
            data: {},
            status: 401,
            statusText: 'Unauthorized',
            headers: {},
            config,
          },
        ),
      );
    apiClient.defaults.adapter = adapter;
    expect(heading('Libros')).toBeInTheDocument();

    await act(async () => {
      await apiClient.get('/books').catch(() => undefined);
    });

    expect(session.getToken()).toBeNull();
    expect(router.state.location.pathname).toBe('/login');
    expect(heading('Iniciar sesión')).toBeInTheDocument();
  });
});
