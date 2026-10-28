import { QueryClientProvider } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { ErrorNoticeContext } from '../hooks/useErrorNotice';
import { getErrorMessage } from '../lib/api-error';
import { createQueryClient } from '../lib/query-client';
import { AuthProvider } from './AuthProvider';
import { ErrorNotice } from './ErrorNotice';

/** Data fetching, the session and the global error notice shared by every page. */
export function AppProviders({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);

  const notice = useMemo(
    () => ({
      notify: (error: unknown) => setMessage(getErrorMessage(error)),
      dismiss: () => setMessage(null),
    }),
    [],
  );
  // Failed queries and mutations report here unless they opt out with `meta.silent`.
  const [queryClient] = useState(() => createQueryClient(notice.notify));

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorNoticeContext value={notice}>
        {/* Inside the query client (it asks the server who is signed in). */}
        <AuthProvider>{children}</AuthProvider>
        <ErrorNotice message={message} onDismiss={notice.dismiss} />
      </ErrorNoticeContext>
    </QueryClientProvider>
  );
}
