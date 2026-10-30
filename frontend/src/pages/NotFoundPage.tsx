import { Link } from 'react-router';
import { useListingPath } from '../hooks/useListingPath';

export function NotFoundPage() {
  const listingPath = useListingPath();

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-2xl font-semibold">Página no encontrada</h1>
      <Link
        to={listingPath}
        className="mt-4 inline-block text-blue-700 underline"
      >
        Volver a los libros
      </Link>
    </main>
  );
}
