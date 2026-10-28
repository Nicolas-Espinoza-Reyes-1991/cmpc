import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from './api-error';

declare module '@tanstack/react-query' {
  interface Register {
    /**
     * `silent: true` marks a query/mutation whose caller shows the error itself
     * (a form with field errors), so the global notice must not repeat it.
     */
    queryMeta: { silent?: boolean };
    mutationMeta: { silent?: boolean };
  }
}

const MAX_RETRIES = 1;

/**
 * One retry for network or server failures. A 4xx is the request's fault and
 * repeating it cannot help (it would only delay the error).
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  const isClientError =
    error instanceof ApiError && error.status >= 400 && error.status < 500;
  return failureCount < MAX_RETRIES && !isClientError;
}

export function createQueryClient(
  onError: (error: unknown) => void,
): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (!query.meta?.silent) onError(error);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _onMutateResult, mutation) => {
        if (!mutation.meta?.silent) onError(error);
      },
    }),
    defaultOptions: {
      queries: { retry: shouldRetry, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}
