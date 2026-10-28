import { createContext, useContext } from 'react';

export interface ErrorNoticeApi {
  /** Shows the message of any error in the global notice. */
  notify: (error: unknown) => void;
  dismiss: () => void;
}

export const ErrorNoticeContext = createContext<ErrorNoticeApi | null>(null);

export function useErrorNotice(): ErrorNoticeApi {
  const api = useContext(ErrorNoticeContext);
  if (!api) {
    throw new Error('useErrorNotice must be used inside <AppProviders>');
  }
  return api;
}
