import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { setUnauthorizedHandler } from './lib/api-client';
import { BookFormPage } from './pages/BookFormPage';
import { BooksPage } from './pages/BooksPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/books', element: <BooksPage /> },
          // `new` is declared before `:id` so it is never read as a book id.
          { path: '/books/new', element: <BookFormPage /> },
          { path: '/books/:id/edit', element: <BookFormPage /> },
        ],
      },
    ],
  },
  { path: '/', element: <Navigate to="/books" replace /> },
  { path: '*', element: <NotFoundPage /> },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}

export type AppRouter = ReturnType<typeof createAppRouter>;

/** On an expired session the API client leaves through the router, without a full reload. */
export function registerUnauthorizedNavigation(router: AppRouter): void {
  setUnauthorizedHandler(() => {
    void router.navigate('/login', { replace: true });
  });
}
