import axios, {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { ApiError } from './api-error';
import { apiClient, setUnauthorizedHandler } from './api-client';
import { session } from './session';

const originalAdapter = apiClient.defaults.adapter;

function response(
  config: InternalAxiosRequestConfig,
  status: number,
  data: unknown,
): AxiosResponse {
  return { data, status, statusText: '', headers: {}, config };
}

/** Replaces the HTTP layer; interceptors still run around it. */
function respondWith(status: number, data: unknown = {}): void {
  const adapter: AxiosAdapter = (config) => {
    const result = response(config, status, data);
    if (status < 400) return Promise.resolve(result);
    return Promise.reject(
      new AxiosError(
        'Request failed',
        AxiosError.ERR_BAD_REQUEST,
        config,
        null,
        result,
      ),
    );
  };
  apiClient.defaults.adapter = adapter;
}

describe('apiClient', () => {
  const onUnauthorized = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    onUnauthorized.mockReset();
    setUnauthorizedHandler(onUnauthorized);
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
    vi.unstubAllGlobals();
  });

  describe('requests', () => {
    it('targets the same-origin /api prefix', () => {
      expect(apiClient.defaults.baseURL).toBe('/api');
    });

    it('sends the stored token as a Bearer header', async () => {
      session.setToken('jwt-token');
      let sent: unknown;
      apiClient.defaults.adapter = (config) => {
        sent = config.headers.get('Authorization');
        return Promise.resolve(response(config, 200, {}));
      };

      await apiClient.get('/books');

      expect(sent).toBe('Bearer jwt-token');
    });

    it('sends no Authorization header without a session', async () => {
      let sent: unknown = 'unset';
      apiClient.defaults.adapter = (config) => {
        sent = config.headers.get('Authorization');
        return Promise.resolve(response(config, 200, {}));
      };

      await apiClient.get('/books');

      expect(sent).toBeFalsy();
    });

    it('returns successful responses untouched', async () => {
      respondWith(200, { data: [{ id: 1 }] });

      const result = await apiClient.get('/books');

      expect(result.data).toEqual({ data: [{ id: 1 }] });
      expect(onUnauthorized).not.toHaveBeenCalled();
    });
  });

  describe('errors (R4.6)', () => {
    it('rejects with a normalized ApiError carrying the field errors', async () => {
      const errors = [
        { field: 'title', messages: ['title should not be empty'] },
      ];
      respondWith(400, { message: 'Validation failed', errors });

      const failure = apiClient.post('/books', {});

      await expect(failure).rejects.toBeInstanceOf(ApiError);
      await expect(failure).rejects.toMatchObject({
        status: 400,
        fieldErrors: errors,
        message: 'Los datos enviados no son válidos.',
      });
    });

    it('reports a connection problem when there is no response', async () => {
      apiClient.defaults.adapter = (config) =>
        Promise.reject(
          new AxiosError('Network Error', AxiosError.ERR_NETWORK, config),
        );

      await expect(apiClient.get('/books')).rejects.toMatchObject({
        isNetworkError: true,
        message: expect.stringContaining('No se pudo conectar') as string,
      });
    });

    it('does not log out on server errors', async () => {
      session.setToken('jwt-token');
      respondWith(500, { message: 'Internal server error' });

      await expect(apiClient.get('/books')).rejects.toMatchObject({
        status: 500,
      });

      expect(session.getToken()).toBe('jwt-token');
      expect(onUnauthorized).not.toHaveBeenCalled();
    });

    it('lets cancellations through without turning them into ApiError', async () => {
      apiClient.defaults.adapter = () =>
        Promise.reject(new axios.CanceledError());

      const failure = apiClient.get('/books');

      await expect(failure).rejects.not.toBeInstanceOf(ApiError);
      await expect(failure).rejects.toSatisfy((error: unknown) =>
        axios.isCancel(error),
      );
      expect(onUnauthorized).not.toHaveBeenCalled();
    });
  });

  describe('expired session (R4.7)', () => {
    it('clears the session and leaves the app on a 401 with a token', async () => {
      session.setToken('expired-token');
      respondWith(401, { message: 'Unauthorized' });

      await expect(apiClient.get('/books')).rejects.toMatchObject({
        status: 401,
      });

      expect(session.getToken()).toBeNull();
      expect(onUnauthorized).toHaveBeenCalledTimes(1);
    });

    it('does not redirect a failed login (401 without a token)', async () => {
      respondWith(401, { message: 'Invalid credentials' });

      await expect(apiClient.post('/auth/login', {})).rejects.toMatchObject({
        status: 401,
      });

      expect(onUnauthorized).not.toHaveBeenCalled();
    });

    it('redirects with a full page load when no handler was registered', async () => {
      const assign = vi.fn();
      vi.stubGlobal('location', { assign });
      setUnauthorizedHandler();
      session.setToken('expired-token');
      respondWith(401, {});

      await expect(apiClient.get('/books')).rejects.toBeInstanceOf(ApiError);

      expect(assign).toHaveBeenCalledWith('/login');
    });
  });
});
