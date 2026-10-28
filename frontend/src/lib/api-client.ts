import axios from 'axios';
import { toApiError } from './api-error';
import { session } from './session';

type UnauthorizedHandler = () => void;

/** Fallback when the router has not registered its own: a full-page redirect. */
function redirectToLogin(): void {
  window.location.assign('/login');
}

let onUnauthorized: UnauthorizedHandler = redirectToLogin;

/**
 * The router registers how to leave the app on an expired session
 * (client-side navigation). Calling it without arguments restores the default.
 */
export function setUnauthorizedHandler(
  handler: UnauthorizedHandler = redirectToLogin,
): void {
  onUnauthorized = handler;
}

export const apiClient = axios.create({
  // Same origin in every environment: Vite proxies it in dev, nginx in Docker.
  baseURL: '/api',
  timeout: 15_000,
  headers: { Accept: 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = session.getToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    // A cancelled request (e.g. TanStack Query aborting) is not a failure to report.
    if (axios.isCancel(error)) throw error;

    const apiError = toApiError(error);

    // Only an existing session can expire. A 401 without a token is a failed
    // login: let the form show it instead of redirecting in a loop (R4.7).
    if (apiError.status === 401 && session.getToken()) {
      session.clear();
      onUnauthorized();
    }

    throw apiError;
  },
);
