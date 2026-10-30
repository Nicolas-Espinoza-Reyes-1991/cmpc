import { Link } from 'react-router';
import { CoverDownload } from './CoverDownload';

interface BookActionsCellProps {
  id: string;
  title: string;
  /** The cover that is on screen; `null` when there is none or it did not load. */
  imageUrl: string | null;
}

/**
 * The last cell of a row of the listing. "Ver" is always there: it is how a book
 * is opened (the title is plain text). The download only when there is a cover to
 * download: a button that cannot work, repeated in every row, would only be noise.
 * Both have the name of the book in their accessible name because the page has
 * many of them.
 */
export function BookActionsCell({ id, title, imageUrl }: BookActionsCellProps) {
  return (
    <div className="flex flex-col items-stretch gap-2">
      {/* At least 44 px tall to touch on a phone; compact from 640 px. */}
      <Link
        to={`/books/${id}`}
        aria-label={`Ver detalle de ${title}`}
        className="inline-flex min-h-11 items-center justify-center rounded-md border border-blue-700 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700 sm:min-h-0"
      >
        Ver
      </Link>
      {imageUrl && <CoverDownload src={imageUrl} title={title} size="row" />}
    </div>
  );
}
