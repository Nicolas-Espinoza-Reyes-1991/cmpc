import { Link, NavLink, Outlet } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { useListingPath } from '../hooks/useListingPath';
import { Logo } from './Logo';

/**
 * Frame of every protected screen: who is signed in and how to leave. Logging
 * out only clears the session; `ProtectedRoute` then sends the user to the login.
 */
export function AppLayout() {
  const { user, logout } = useAuth();
  const listingPath = useListingPath();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              to={listingPath}
              aria-label="CMPC Libros, ir al listado"
              className="shrink-0 rounded-md focus:outline-2 focus:outline-offset-2 focus:outline-blue-700"
            >
              <Logo className="h-8" />
            </Link>
            <nav aria-label="Principal">
              {/* `aria-current` (set by NavLink in the listing, a book and its forms) styles it as active. */}
              <NavLink
                to={listingPath}
                className="rounded px-1 py-0.5 text-sm font-medium text-slate-600 hover:text-slate-900 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700 aria-[current=page]:font-semibold aria-[current=page]:text-slate-900 aria-[current=page]:underline aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-8"
              >
                Libros
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="truncate text-slate-600" title={user?.email}>
              {user?.email}
            </span>
            <button
              type="button"
              onClick={logout}
              className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
