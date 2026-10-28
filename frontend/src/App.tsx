import { RouterProvider } from 'react-router';
import { AppProviders } from './components/AppProviders';
import type { AppRouter } from './router';

export default function App({ router }: { router: AppRouter }) {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
