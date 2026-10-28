import { Navigate, Outlet, useLocation } from 'react-router';
import { session } from '../lib/session';

/**
 * Lets the nested routes render only with a session; otherwise sends the user
 * to the login and remembers where they were going.
 */
export function ProtectedRoute() {
  const location = useLocation();

  if (!session.getToken()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
