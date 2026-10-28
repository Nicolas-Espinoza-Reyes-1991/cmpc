import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { AuthStatusScreen } from './AuthStatusScreen';

/**
 * Lets the nested routes render only for a verified session. While the saved
 * token is being checked it waits instead of flashing the login; if the check
 * fails for a reason that is not "invalid token" it offers to retry; without a
 * session it sends the user to the login and remembers where they were going.
 */
export function ProtectedRoute() {
  const location = useLocation();
  const { status, errorMessage, retry } = useAuth();

  switch (status) {
    case 'loading':
      return <AuthStatusScreen state="loading" />;
    case 'error':
      return (
        <AuthStatusScreen
          state="error"
          message={errorMessage}
          onRetry={retry}
        />
      );
    case 'anonymous':
      return (
        <Navigate to="/login" replace state={{ from: location.pathname }} />
      );
    case 'authenticated':
      return <Outlet />;
  }
}
