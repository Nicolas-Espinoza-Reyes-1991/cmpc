import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { session } from '../lib/session';
import { routes } from '../router';
import { mockApi, type MockApi } from '../test/mock-api';
import { AppProviders } from './AppProviders';

const ADMIN = { id: 'id-admin', email: 'admin@cmpc.local' };

function renderBooks() {
  const router = createMemoryRouter(routes, { initialEntries: ['/books'] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

describe('AppLayout', () => {
  let api: MockApi;

  beforeEach(() => {
    localStorage.clear();
    session.setToken('jwt-token');
    api = mockApi({ 'GET /auth/me': { data: { data: ADMIN } } });
  });

  afterEach(() => {
    api.restore();
  });

  it('shows the application name and who is signed in', async () => {
    renderBooks();

    expect(await screen.findByText(ADMIN.email)).toBeInTheDocument();
    expect(screen.getByText('CMPC Libros')).toBeInTheDocument();
  });

  it('renders the protected page inside the layout', async () => {
    renderBooks();

    const heading = await screen.findByRole('heading', { name: 'Libros' });
    const banner = screen.getByRole('banner');

    expect(banner).toBeInTheDocument();
    expect(banner.contains(heading)).toBe(false);
  });

  it('signs out, forgets the token and goes to the login', async () => {
    const router = renderBooks();
    await screen.findByText(ADMIN.email);

    await userEvent.click(
      screen.getByRole('button', { name: 'Cerrar sesión' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Iniciar sesión' }),
    ).toBeInTheDocument();
    expect(session.getToken()).toBeNull();
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.queryByText(ADMIN.email)).not.toBeInTheDocument();
  });
});
