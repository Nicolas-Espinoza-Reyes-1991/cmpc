import { render, screen } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import App from './App';
import { session } from './lib/session';
import { routes } from './router';

function renderAt(path: string) {
  render(
    <App router={createMemoryRouter(routes, { initialEntries: [path] })} />,
  );
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the current route inside the providers', () => {
    renderAt('/login');

    expect(
      screen.getByRole('heading', { name: 'Iniciar sesión' }),
    ).toBeInTheDocument();
  });

  it('keeps the protected routes behind the session', () => {
    session.setToken('jwt-token');

    renderAt('/books');

    expect(screen.getByRole('heading', { name: 'Libros' })).toBeInTheDocument();
  });
});
