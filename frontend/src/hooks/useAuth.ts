import { createContext, useContext } from 'react';
import type { AuthUser, LoginCredentials } from '../types/auth';

/**
 * - `anonymous`: no session.
 * - `loading`: there is a saved token and the server is still checking it.
 * - `authenticated`: the server confirmed the token and told us who it is.
 * - `error`: the token could not be checked (network or server failure); the
 *   session is kept, because that says nothing about whether it is valid.
 */
export type AuthStatus = 'anonymous' | 'loading' | 'authenticated' | 'error';

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  /** Spanish explanation of why the session could not be verified (status `error`). */
  errorMessage: string | undefined;
  /** Rejects with an `ApiError` when the credentials are refused. */
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  /** Checks the saved token again after an `error`. */
  retry: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside <AppProviders>');
  }
  return value;
}
