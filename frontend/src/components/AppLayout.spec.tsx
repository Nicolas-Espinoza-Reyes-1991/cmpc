import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { listingView } from '../lib/listingView';
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
    listingView.clear();
  });

  it('shows the logo and who is signed in', async () => {
    renderBooks();

    expect(await screen.findByText(ADMIN.email)).toBeInTheDocument();
    expect(
      within(screen.getByRole('banner')).getByRole('img', {
        name: 'CMPC Libros',
      }),
    ).toBeInTheDocument();
  });

  it('takes the logo back to the list of books', async () => {
    const router = renderBooks();
    await screen.findByText(ADMIN.email);
    await router.navigate('/books/new');

    await userEvent.click(
      screen.getByRole('link', { name: 'CMPC Libros, ir al listado' }),
    );

    expect(router.state.location.pathname).toBe('/books');
  });

  it('takes the logo back to the view of the list the user had', async () => {
    const router = renderBooks();
    await screen.findByText(ADMIN.email);
    await router.navigate('/books?q=dune');
    await waitFor(() => expect(listingView.read()).toBe('?q=dune'));
    await router.navigate('/books/new');

    await userEvent.click(
      screen.getByRole('link', { name: 'CMPC Libros, ir al listado' }),
    );

    expect(router.state.location.search).toBe('?q=dune');
  });

  it('marks "Libros" as the active section in the list, a book and its forms', async () => {
    const router = renderBooks();
    const nav = within(
      await screen.findByRole('navigation', { name: 'Principal' }),
    );

    expect(nav.getByRole('link', { name: 'Libros' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    for (const path of ['/books/new', '/books/id-1', '/books/id-1/edit']) {
      await router.navigate(path);
      expect(nav.getByRole('link', { name: 'Libros' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    }
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
