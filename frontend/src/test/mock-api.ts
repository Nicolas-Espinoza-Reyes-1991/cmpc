import {
  AxiosError,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios';
import { apiClient } from '../lib/api-client';

export interface MockReply {
  status?: number;
  data?: unknown;
  headers?: Record<string, string>;
  /** Simulates a failure with no HTTP response at all (network down). */
  network?: boolean;
}

/** A fixed answer, or a function that decides it from the request (e.g. by token). */
export type MockRoute =
  | MockReply
  | ((config: InternalAxiosRequestConfig) => MockReply | Promise<MockReply>);

export interface MockApi {
  /** Every request that reached the HTTP layer, in order. */
  requests: InternalAxiosRequestConfig[];
  restore: () => void;
}

/**
 * Replaces the HTTP layer of the real client with canned answers; its
 * interceptors (token, ApiError, 401 handling) still run. Routes are keyed
 * "METHOD /path", e.g. "GET /auth/me". A request with no route behaves like a
 * network failure, so a missing mock fails loudly instead of hanging.
 */
export function mockApi(routes: Record<string, MockRoute>): MockApi {
  const original = apiClient.defaults.adapter;
  const requests: InternalAxiosRequestConfig[] = [];

  const adapter: AxiosAdapter = async (config) => {
    requests.push(config);
    const key = `${(config.method ?? 'get').toUpperCase()} ${config.url ?? ''}`;
    const route = routes[key];
    const reply = typeof route === 'function' ? await route(config) : route;

    if (!reply || reply.network) {
      throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
    }
    const status = reply.status ?? 200;
    const response = {
      data: reply.data,
      status,
      statusText: '',
      headers: reply.headers ?? {},
      config,
    };
    if (status >= 400) {
      throw new AxiosError(
        'Request failed',
        AxiosError.ERR_BAD_REQUEST,
        config,
        null,
        response,
      );
    }
    return response;
  };

  apiClient.defaults.adapter = adapter;
  return {
    requests,
    restore: () => {
      apiClient.defaults.adapter = original;
    },
  };
}
