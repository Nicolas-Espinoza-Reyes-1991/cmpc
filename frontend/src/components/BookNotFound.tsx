import { Link } from 'react-router';

/** Shown when a book does not exist or was deleted (a 404 from the API). */
export function BookNotFound() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold text-slate-900">
        Libro no encontrado
      </h1>
      <p className="mt-2 text-slate-600">
        Es posible que se haya eliminado o que el enlace no sea correcto.
      </p>
      <Link to="/books" className="mt-4 inline-block text-blue-700 underline">
        Volver a los libros
      </Link>
    </main>
  );
}
