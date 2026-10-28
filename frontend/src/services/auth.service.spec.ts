import {
  AxiosError,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios';
import { apiClient, setUnauthorizedHandler } from '../lib/api-client';
import { ApiError } from '../lib/api-error';
import { session } from '../lib/session';
import type { AuthUser, LoginResponse } from '../types/auth';
import { getMe, login } from './auth.service';

const user: AuthUser = {
  id: '3017f450-2092-454d-9a62-14ad55557302',
  email: 'admin@cmpc.local',
};
const loginResponse: LoginResponse = {
  accessToken: 'header.payload.signature',
  tokenType: 'Bearer',
  expiresAt: '2026-10-28T03:12:33.000Z',
  user,
};

const originalAdapter = apiClient.defaults.adapter;
let lastRequest: InternalAxiosRequestConfig | undefined;

/** Replaces the HTTP layer; the interceptors of the real client still run. */
function respondWith(status: number, body: unknown): void {
  const adapter: AxiosAdapter = (config) => {
    lastRequest = config;
    const response = {
      data: body,
      status,
      statusText: '',
      headers: {},
      config,
    };
    if (status < 400) return Promise.resolve(response);
    return Promise.reject(
      new AxiosError(
        'Request failed',
        AxiosError.ERR_BAD_REQUEST,
        config,
        null,
        response,
      ),
    );
  };
  apiClient.defaults.adapter = adapter;
}

describe('auth service', () => {
  const onUnauthorized = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    lastRequest = undefined;
    onUnauthorized.mockReset();
    setUnauthorizedHandler(onUnauthorized);
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
    setUnauthorizedHandler();
  });

  describe('login', () => {
    it('posts the credentials to /auth/login', async () => {
      respondWith(200, { data: loginResponse });

      await login({ email: 'admin@cmpc.local', password: 'change-me' });

      expect(lastRequest?.method).toBe('post');
      expect(lastRequest?.url).toBe('/auth/login');
      expect(lastRequest?.baseURL).toBe('/api');
      expect(JSON.parse(lastRequest?.data as string)).toEqual({
        email: 'admin@cmpc.local',
        password: 'change-me',
      });
    });

    it('returns the content of data, not the envelope', async () => {
      respondWith(200, { data: loginResponse });

      await expect(
        login({ email: 'admin@cmpc.local', password: 'change-me' }),
      ).resolves.toEqual(loginResponse);
    });

    it('sends no Authorization header when there is no session', async () => {
      respondWith(200, { data: loginResponse });

      await login({ email: 'admin@cmpc.local', password: 'change-me' });

      expect(lastRequest?.headers.get('Authorization')).toBeFalsy();
    });

    it('reports wrong credentials as a 401 ApiError without leaving the app', async () => {
      respondWith(401, { statusCode: 401, message: 'Invalid credentials' });

      const failure = login({ email: 'admin@cmpc.local', password: 'mala' });

      await expect(failure).rejects.toBeInstanceOf(ApiError);
      await expect(failure).rejects.toMatchObject({
        status: 401,
        serverMessage: 'Invalid credentials',
      });
      // A failed login has no session to expire: nothing to redirect (A5.4).
      expect(onUnauthorized).not.toHaveBeenCalled();
    });

    it('reports the rate limit as a 429 with a Spanish message', async () => {
      respondWith(429, { statusCode: 429, message: 'Too many requests' });

      await expect(
        login({ email: 'admin@cmpc.local', password: 'x' }),
      ).rejects.toMatchObject({
        status: 429,
        message: expect.stringContaining('Demasiados intentos') as string,
      });
    });

    it('keeps the field errors of a validation failure', async () => {
      const errors = [{ field: 'email', messages: ['email must be an email'] }];
      respondWith(400, {
        statusCode: 400,
        message: 'Validation failed',
        errors,
      });

      await expect(login({ email: 'x', password: 'y' })).rejects.toMatchObject({
        status: 400,
        fieldErrors: errors,
      });
    });

    it('reports a network failure as a connection error', async () => {
      apiClient.defaults.adapter = (config) =>
        Promise.reject(
          new AxiosError('Network Error', AxiosError.ERR_NETWORK, config),
        );

      await expect(
        login({ email: 'admin@cmpc.local', password: 'x' }),
      ).rejects.toMatchObject({ isNetworkError: true });
    });
  });

  describe('getMe', () => {
    it('gets /auth/me with the stored token', async () => {
      session.setToken('stored-token');
      respondWith(200, { data: user });

      await getMe();

      expect(lastRequest?.method).toBe('get');
      expect(lastRequest?.url).toBe('/auth/me');
      expect(lastRequest?.headers.get('Authorization')).toBe(
        'Bearer stored-token',
      );
    });

    it('returns the user inside data', async () => {
      respondWith(200, { data: user });

      await expect(getMe()).resolves.toEqual(user);
    });

    it('forwards the abort signal so a query can be cancelled', async () => {
      respondWith(200, { data: user });
      const controller = new AbortController();

      await getMe(controller.signal);

      expect(lastRequest?.signal).toBe(controller.signal);
    });

    it('closes the session when the token is no longer valid (A5.4)', async () => {
      session.setToken('expired-token');
      respondWith(401, { statusCode: 401, message: 'Unauthorized' });

      await expect(getMe()).rejects.toMatchObject({ status: 401 });

      expect(session.getToken()).toBeNull();
      expect(onUnauthorized).toHaveBeenCalledTimes(1);
    });

    it('keeps the session on a server error', async () => {
      session.setToken('valid-token');
      respondWith(500, { statusCode: 500, message: 'Internal server error' });

      await expect(getMe()).rejects.toMatchObject({ status: 500 });

      expect(session.getToken()).toBe('valid-token');
      expect(onUnauthorized).not.toHaveBeenCalled();
    });
  });
});
