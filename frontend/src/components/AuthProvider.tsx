import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useCallback,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
} from '../hooks/useAuth';
import { getErrorMessage } from '../lib/api-error';
import { listingView } from '../lib/listingView';
import { session } from '../lib/session';
import { getMe, login as requestLogin } from '../services/auth.service';
import type { LoginCredentials } from '../types/auth';

/**
 * Who is signed in, derived from the token in `session` and from asking the
 * server who it belongs to. It follows the session reactively: a 401 that clears
 * the token, or a logout in another tab, changes `status` without a reload.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const token = useSyncExternalStore(session.subscribe, session.getToken);

  const me = useQuery({
    // Keyed by token: if another tab signs in as somebody else, this tab never
    // keeps showing the previous user.
    queryKey: ['auth', 'me', token],
    queryFn: ({ signal }) => getMe(signal),
    enabled: token !== null,
    // A verified session stays verified: the 401 handler covers it expiring.
    staleTime: Infinity,
    // The error screen offers its own "Reintentar".
    retry: false,
    // This provider decides what to show; the global notice would repeat it.
    meta: { silent: true },
  });
  const { refetch } = me;

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      const { accessToken, user } = await requestLogin(credentials);
      // The user is already known from the response: seed it before the token
      // appears so there is no "loading" flash and no extra request.
      queryClient.setQueryData(['auth', 'me', accessToken], user);
      session.setToken(accessToken);
    },
    [queryClient],
  );

  const logout = useCallback(() => {
    session.clear();
    // Nothing fetched for this user may be shown to the next one (A5.5), nor the
    // filters they had typed.
    queryClient.clear();
    listingView.clear();
  }, [queryClient]);

  const retry = useCallback(() => {
    void refetch();
  }, [refetch]);

  const status = deriveStatus(token, me);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      // `isSuccess` narrows `data` to a user; without a token the query is
      // disabled and can never be successful, so this is `null` exactly when anonymous.
      user: me.isSuccess ? me.data : null,
      errorMessage: status === 'error' ? getErrorMessage(me.error) : undefined,
      login,
      logout,
      retry,
    }),
    [status, me.isSuccess, me.data, me.error, login, logout, retry],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

function deriveStatus(
  token: string | null,
  me: { isSuccess: boolean; isError: boolean; isFetching: boolean },
): AuthStatus {
  if (token === null) return 'anonymous';
  if (me.isSuccess) return 'authenticated';
  // After "Reintentar" the query keeps its old error until the new answer
  // arrives; the screen should say "verifying" meanwhile, not repeat the error.
  if (me.isError && !me.isFetching) return 'error';
  return 'loading';
}
