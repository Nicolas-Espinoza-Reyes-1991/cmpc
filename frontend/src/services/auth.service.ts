import { apiClient } from '../lib/api-client';
import type { ApiResponse } from '../types/api';
import type { AuthUser, LoginCredentials, LoginResponse } from '../types/auth';

/** Exchanges credentials for a token. The API wraps every answer as `{ data }`. */
export async function login(
  credentials: LoginCredentials,
): Promise<LoginResponse> {
  const response = await apiClient.post<ApiResponse<LoginResponse>>(
    '/auth/login',
    credentials,
  );
  return response.data.data;
}

/**
 * The user the stored token belongs to. It is also how the app finds out that a
 * saved session is still valid. `signal` lets TanStack Query cancel the request.
 */
export async function getMe(signal?: AbortSignal): Promise<AuthUser> {
  const response = await apiClient.get<ApiResponse<AuthUser>>('/auth/me', {
    signal,
  });
  return response.data.data;
}
