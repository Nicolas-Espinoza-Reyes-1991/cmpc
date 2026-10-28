import { render, screen } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import App from './App';
import { session } from './lib/session';
import { mockApi, type MockApi } from './test/mock-api';
import { routes } from './router';

function renderAt(path: string) {
  render(
    <App router={createMemoryRouter(routes, { initialEntries: [path] })} />,
  );
}

describe('App', () => {
  let api: MockApi;

  beforeEach(() => {
    localStorage.clear();
    api = mockApi({
      'GET /auth/me': {
        data: { data: { id: 'id-admin', email: 'admin@cmpc.local' } },
      },
    });
  });

  afterEach(() => {
    api.restore();
  });

  it('renders the current route inside the providers', async () => {
    renderAt('/login');

    expect(
      await screen.findByRole('heading', { name: 'Iniciar sesión' }),
    ).toBeInTheDocument();
  });

  it('keeps the protected routes behind a session the server confirms', async () => {
    session.setToken('jwt-token');

    renderAt('/books');

    expect(
      await screen.findByRole('heading', { name: 'Libros' }),
    ).toBeInTheDocument();
  });

  it('does not show the protected routes to a visitor without a session', async () => {
    renderAt('/books');

    expect(
      await screen.findByRole('heading', { name: 'Iniciar sesión' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Libros' }),
    ).not.toBeInTheDocument();
  });
});
