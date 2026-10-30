import { useEffect } from 'react';

const APP_NAME = 'CMPC Libros';

/**
 * The title of the browser tab says where the user is («Dune · CMPC Libros»):
 * tabs, the history and bookmarks are told apart. The previous one is restored
 * when the screen goes away.
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · ${APP_NAME}`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
