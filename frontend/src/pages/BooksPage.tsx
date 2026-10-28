import { Link } from 'react-router';

// Placeholder: the listing arrives with the `books-listing` spec. Until then
// this page is the way into the "new book" form.
export function BooksPage() {
  return (
    <main className="mx-auto max-w-5xl p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Libros</h1>
        <Link
          to="/books/new"
          className="rounded-md bg-blue-700 px-4 py-2 font-medium text-white hover:bg-blue-800 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700"
        >
          Nuevo libro
        </Link>
      </div>
    </main>
  );
}
