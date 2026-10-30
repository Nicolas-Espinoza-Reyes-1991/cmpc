import { Link } from 'react-router';
import { useListingPath } from '../hooks/useListingPath';

/**
 * The way back at the top of a book: where the user is («Libros › título») and a
 * button that is seen as one. Both return to the listing with the view the user
 * left, not to an unfiltered list.
 */
export function BookBreadcrumb({ title }: { title: string }) {
  const listingPath = useListingPath();

  return (
    <div className="mb-6 space-y-3">
      <nav aria-label="Ruta de navegación">
        <ol className="flex flex-wrap items-center gap-x-2 text-sm text-slate-600">
          <li>
            <Link
              to={listingPath}
              className="rounded font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700"
            >
              Libros
            </Link>
          </li>
          <li aria-hidden="true">›</li>
          <li aria-current="page" className="min-w-0 break-words">
            {title}
          </li>
        </ol>
      </nav>
      <Link
        to={listingPath}
        className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 font-medium text-slate-800 hover:bg-slate-100 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700"
      >
        <span aria-hidden="true">←</span>
        Volver a los libros
      </Link>
    </div>
  );
}
