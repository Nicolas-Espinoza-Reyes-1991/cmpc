import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-2xl font-semibold">Página no encontrada</h1>
      <Link to="/books" className="mt-4 inline-block text-blue-700 underline">
        Volver a los libros
      </Link>
    </main>
  );
}
