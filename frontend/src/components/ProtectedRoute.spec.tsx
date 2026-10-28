import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createMemoryRouter,
  RouterProvider,
  type RouteObject,
} from 'react-router';
import { setUnauthorizedHandler } from '../lib/api-client';
import { session } from '../lib/session';
import { mockApi, type MockApi, type MockReply } from '../test/mock-api';
import { AppProviders } from './AppProviders';
import { ProtectedRoute } from './ProtectedRoute';

const ADMIN = { id: 'id-admin', email: 'admin@cmpc.local' };

const routes: RouteObject[] = [
  { path: '/login', element: <p>login page</p> },
  {
    element: <ProtectedRoute />,
    children: [{ path: '/private', element: <p>secret content</p> }],
  },
];

function renderPrivate() {
  const router = createMemoryRouter(routes, { initialEntries: ['/private'] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

describe('ProtectedRoute', () => {
  let api: MockApi;

  beforeEach(() => {
    localStorage.clear();
    setUnauthorizedHandler(vi.fn());
  });

  afterEach(() => {
    api?.restore();
    setUnauthorizedHandler();
  });

  describe('anonymous', () => {
    it('sends the visitor to the login and remembers where they were going', async () => {
      api = mockApi({});

      const router = renderPrivate();

      expect(await screen.findByText('login page')).toBeInTheDocument();
      expect(screen.queryByText('secret content')).not.toBeInTheDocument();
      expect(router.state.location.state).toEqual({ from: '/private' });
    });

    it('replaces the blocked page in the history, so "back" cannot return to it', async () => {
      api = mockApi({});

      const router = renderPrivate();
      await screen.findByText('login page');

      expect(router.state.historyAction).toBe('REPLACE');
    });
  });

  describe('while the saved session is being verified', () => {
    it('waits, without flashing the login or the content', async () => {
      session.setToken('saved-token');
      // Created up front: the request reaches the mock asynchronously, and the
      // answer must be resolvable whether or not it has arrived yet.
      let finish!: (reply: MockReply) => void;
      const answer = new Promise<MockReply>((resolve) => {
        finish = resolve;
      });
      api = mockApi({ 'GET /auth/me': () => answer });

      renderPrivate();

      expect(screen.getByRole('status')).toHaveTextContent(
        'Verificando sesión…',
      );
      expect(screen.queryByText('login page')).not.toBeInTheDocument();
      expect(screen.queryByText('secret content')).not.toBeInTheDocument();

      await act(async () => {
        finish({ data: { data: ADMIN } });
        // Let the resolved request settle inside act.
        await Promise.resolve();
      });
      expect(await screen.findByText('secret content')).toBeInTheDocument();
    });
  });

  describe('authenticated', () => {
    it('shows the protected content', async () => {
      session.setToken('saved-token');
      api = mockApi({ 'GET /auth/me': { data: { data: ADMIN } } });

      renderPrivate();

      expect(await screen.findByText('secret content')).toBeInTheDocument();
    });

    it('sends the user to the login as soon as the session ends, without a reload', async () => {
      session.setToken('saved-token');
      api = mockApi({ 'GET /auth/me': { data: { data: ADMIN } } });
      const router = renderPrivate();
      await screen.findByText('secret content');

      act(() => session.clear());

      expect(await screen.findByText('login page')).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/login');
    });
  });

  describe('when the token is not valid', () => {
    it('goes to the login', async () => {
      session.setToken('expired-token');
      api = mockApi({ 'GET /auth/me': { status: 401, data: {} } });

      renderPrivate();

      expect(await screen.findByText('login page')).toBeInTheDocument();
    });
  });

  describe('when the check fails for another reason', () => {
    it('shows the error with "Reintentar" instead of signing the user out', async () => {
      session.setToken('saved-token');
      api = mockApi({ 'GET /auth/me': { network: true } });

      renderPrivate();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'No se pudo conectar con el servidor',
      );
      expect(screen.queryByText('login page')).not.toBeInTheDocument();
      expect(session.getToken()).toBe('saved-token');
    });

    it('lets the user retry and then shows the content', async () => {
      session.setToken('saved-token');
      let answer: MockReply = { status: 503, data: {} };
      api = mockApi({ 'GET /auth/me': () => answer });
      renderPrivate();
      await screen.findByRole('alert');

      answer = { data: { data: ADMIN } };
      await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(await screen.findByText('secret content')).toBeInTheDocument();
    });
  });
});
