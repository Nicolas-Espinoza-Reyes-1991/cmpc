import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiClient, setUnauthorizedHandler } from '../lib/api-client';
import { ApiError } from '../lib/api-error';
import { session } from '../lib/session';
import {
  mockApi,
  type MockApi,
  type MockReply,
  type MockRoute,
} from '../test/mock-api';
import type { LoginResponse } from '../types/auth';
import { AppProviders } from './AppProviders';

const ADMIN = { id: 'id-admin', email: 'admin@cmpc.local' };
const OTHER = { id: 'id-other', email: 'other@cmpc.local' };

function loginResponse(user: typeof ADMIN, accessToken: string): LoginResponse {
  return {
    accessToken,
    tokenType: 'Bearer',
    expiresAt: '2026-10-28T10:00:00.000Z',
    user,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** Shows everything the context exposes and lets the test drive it. */
function Probe({ onClient }: { onClient: (client: QueryClient) => void }) {
  const { status, user, errorMessage, login, logout, retry } = useAuth();
  const queryClient = useQueryClient();
  const [loginError, setLoginError] = useState('none');
  useEffect(() => onClient(queryClient), [onClient, queryClient]);

  return (
    <div>
      <p>status: {status}</p>
      <p>user: {user?.email ?? 'none'}</p>
      <p>error: {errorMessage ?? 'none'}</p>
      <p>login error: {loginError}</p>
      <button
        type="button"
        onClick={() => {
          login({ email: 'admin@cmpc.local', password: 'change-me' }).catch(
            (error: unknown) =>
              setLoginError(
                error instanceof ApiError ? String(error.status) : 'other',
              ),
          );
        }}
      >
        Entrar
      </button>
      <button type="button" onClick={logout}>
        Salir
      </button>
      <button type="button" onClick={retry}>
        Reintentar
      </button>
    </div>
  );
}

function renderProbe() {
  const captured: { client?: QueryClient } = {};
  render(
    <AppProviders>
      <Probe
        onClient={(client) => {
          captured.client = client;
        }}
      />
    </AppProviders>,
  );
  return captured;
}

const status = (value: string) => screen.findByText(`status: ${value}`);

describe('AuthProvider', () => {
  let api: MockApi;
  const onUnauthorized = vi.fn();

  const mount = (routes: Record<string, MockRoute>) => {
    api = mockApi(routes);
  };

  beforeEach(() => {
    localStorage.clear();
    onUnauthorized.mockReset();
    setUnauthorizedHandler(onUnauthorized);
  });

  afterEach(() => {
    api?.restore();
    setUnauthorizedHandler();
  });

  describe('without a saved session', () => {
    it('is anonymous and asks the server nothing', async () => {
      mount({});

      renderProbe();

      expect(await status('anonymous')).toBeInTheDocument();
      expect(screen.getByText('user: none')).toBeInTheDocument();
      expect(api.requests).toHaveLength(0);
    });
  });

  describe('with a saved token', () => {
    it('waits while the server checks it, then knows the user', async () => {
      session.setToken('saved-token');
      mount({ 'GET /auth/me': { data: { data: ADMIN } } });

      renderProbe();

      expect(screen.getByText('status: loading')).toBeInTheDocument();
      expect(await status('authenticated')).toBeInTheDocument();
      expect(screen.getByText('user: admin@cmpc.local')).toBeInTheDocument();
    });

    it('sends the saved token to /auth/me', async () => {
      session.setToken('saved-token');
      mount({ 'GET /auth/me': { data: { data: ADMIN } } });

      renderProbe();
      await status('authenticated');

      expect(api.requests).toHaveLength(1);
      expect(api.requests[0]?.headers.get('Authorization')).toBe(
        'Bearer saved-token',
      );
    });

    it('becomes anonymous and drops the token when the server says it is invalid', async () => {
      session.setToken('expired-token');
      mount({
        'GET /auth/me': { status: 401, data: { message: 'Unauthorized' } },
      });

      renderProbe();

      expect(await status('anonymous')).toBeInTheDocument();
      expect(session.getToken()).toBeNull();
      expect(onUnauthorized).toHaveBeenCalledTimes(1);
    });

    it('does not repeat its own failure in the global notice', async () => {
      session.setToken('saved-token');
      mount({ 'GET /auth/me': { status: 500, data: {} } });

      renderProbe();
      await status('error');

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('when the saved token cannot be checked (A5.3)', () => {
    it('reports a server failure and keeps the session', async () => {
      session.setToken('saved-token');
      mount({ 'GET /auth/me': { status: 500, data: {} } });

      renderProbe();

      expect(await status('error')).toBeInTheDocument();
      expect(
        screen.getByText(/error: Ocurrió un error en el servidor/),
      ).toBeInTheDocument();
      expect(session.getToken()).toBe('saved-token');
      expect(onUnauthorized).not.toHaveBeenCalled();
    });

    it('reports a network failure with the connection message', async () => {
      session.setToken('saved-token');
      mount({ 'GET /auth/me': { network: true } });

      renderProbe();

      expect(await status('error')).toBeInTheDocument();
      expect(
        screen.getByText(/error: No se pudo conectar con el servidor/),
      ).toBeInTheDocument();
      expect(session.getToken()).toBe('saved-token');
    });

    it('checks again on retry and recovers', async () => {
      session.setToken('saved-token');
      let answer: MockReply = { status: 500, data: {} };
      mount({ 'GET /auth/me': () => answer });
      renderProbe();
      await status('error');

      answer = { data: { data: ADMIN } };
      await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(await status('authenticated')).toBeInTheDocument();
      expect(screen.getByText('error: none')).toBeInTheDocument();
    });

    it('says "loading" while retrying instead of repeating the old error', async () => {
      session.setToken('saved-token');
      const pending = deferred<MockReply>();
      let calls = 0;
      mount({
        'GET /auth/me': () =>
          ++calls === 1 ? { status: 500, data: {} } : pending.promise,
      });
      renderProbe();
      await status('error');

      await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(await status('loading')).toBeInTheDocument();
      await act(async () => {
        pending.resolve({ data: { data: ADMIN } });
        // Let the resolved request settle inside act.
        await Promise.resolve();
      });
      expect(await status('authenticated')).toBeInTheDocument();
    });
  });

  describe('login', () => {
    it('stores the token and knows the user without asking /auth/me again', async () => {
      mount({
        'POST /auth/login': {
          data: { data: loginResponse(ADMIN, 'fresh-token') },
        },
      });
      renderProbe();
      await status('anonymous');

      await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

      expect(await status('authenticated')).toBeInTheDocument();
      expect(screen.getByText('user: admin@cmpc.local')).toBeInTheDocument();
      expect(session.getToken()).toBe('fresh-token');
      expect(
        api.requests.filter((request) => request.url === '/auth/me'),
      ).toHaveLength(0);
    });

    it('rejects with the ApiError and stays anonymous when the credentials are refused', async () => {
      mount({
        'POST /auth/login': {
          status: 401,
          data: { message: 'Invalid credentials' },
        },
      });
      renderProbe();
      await status('anonymous');

      await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

      expect(await screen.findByText('login error: 401')).toBeInTheDocument();
      expect(screen.getByText('status: anonymous')).toBeInTheDocument();
      expect(session.getToken()).toBeNull();
    });
  });

  describe('logout', () => {
    it('clears the token and every cached query (A5.5)', async () => {
      session.setToken('saved-token');
      mount({ 'GET /auth/me': { data: { data: ADMIN } } });
      const captured = renderProbe();
      await status('authenticated');
      captured.client?.setQueryData(['books', 'page-1'], ['a private book']);
      const withData = () =>
        (captured.client?.getQueryCache().getAll() ?? []).filter(
          (query) => query.state.data !== undefined,
        );
      // The verified user and the private book are cached.
      expect(withData()).toHaveLength(2);

      await userEvent.click(screen.getByRole('button', { name: 'Salir' }));

      expect(await status('anonymous')).toBeInTheDocument();
      expect(session.getToken()).toBeNull();
      // Not a single piece of data of the previous session survives. (The provider's
      // own query, disabled without a token, is recreated empty: it holds nothing.)
      expect(withData()).toHaveLength(0);
      expect(
        captured.client?.getQueryData(['books', 'page-1']),
      ).toBeUndefined();
    });
  });

  describe('following the session without a reload', () => {
    it('becomes anonymous when a later request is answered with 401 (A5.4)', async () => {
      session.setToken('saved-token');
      mount({
        'GET /auth/me': { data: { data: ADMIN } },
        'GET /books': { status: 401, data: {} },
      });
      renderProbe();
      await status('authenticated');

      await act(async () => {
        await apiClient.get('/books').catch(() => undefined);
      });

      expect(await status('anonymous')).toBeInTheDocument();
    });

    it('becomes anonymous when another tab logs out (A5.6)', async () => {
      session.setToken('saved-token');
      mount({ 'GET /auth/me': { data: { data: ADMIN } } });
      renderProbe();
      await status('authenticated');

      act(() => {
        localStorage.removeItem('cmpc.token');
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'cmpc.token',
            storageArea: localStorage,
          }),
        );
      });

      expect(await status('anonymous')).toBeInTheDocument();
      expect(screen.getByText('user: none')).toBeInTheDocument();
    });

    it('shows the new user, not the old one, when another tab signs in as somebody else', async () => {
      const usersByToken: Record<string, typeof ADMIN> = {
        'Bearer token-admin': ADMIN,
        'Bearer token-other': OTHER,
      };
      mount({
        'POST /auth/login': {
          data: { data: loginResponse(ADMIN, 'token-admin') },
        },
        'GET /auth/me': (config) => ({
          data: {
            data: usersByToken[String(config.headers.get('Authorization'))],
          },
        }),
      });
      renderProbe();
      await userEvent.click(
        await screen.findByRole('button', { name: 'Entrar' }),
      );
      expect(
        await screen.findByText('user: admin@cmpc.local'),
      ).toBeInTheDocument();

      act(() => {
        localStorage.setItem('cmpc.token', 'token-other');
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'cmpc.token',
            storageArea: localStorage,
          }),
        );
      });

      expect(
        await screen.findByText('user: other@cmpc.local'),
      ).toBeInTheDocument();
      expect(
        screen.queryByText('user: admin@cmpc.local'),
      ).not.toBeInTheDocument();
    });
  });

  it('fails loudly when useAuth is used outside the provider', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    expect(() => render(<Probe onClient={() => undefined} />)).toThrow();

    consoleError.mockRestore();
  });
});
