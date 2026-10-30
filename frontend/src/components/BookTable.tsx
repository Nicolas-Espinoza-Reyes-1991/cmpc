import { useState } from 'react';
import { Link } from 'react-router';
import { formatDateTime, formatPrice } from '../lib/format';
import type { Book, SortCriterion, SortField } from '../types/book';
import { BookCoverCell } from './BookCoverCell';
import { BookDownloadCell } from './BookDownloadCell';

interface Column {
  field: SortField;
  label: string;
  align?: 'right';
}

const COLUMNS: readonly Column[] = [
  { field: 'title', label: 'Título' },
  { field: 'author', label: 'Autor' },
  { field: 'publisher', label: 'Editorial' },
  { field: 'genre', label: 'Género' },
  { field: 'price', label: 'Precio', align: 'right' },
  { field: 'availability', label: 'Disponibilidad' },
  { field: 'createdAt', label: 'Registrado' },
];

interface BookTableProps {
  books: readonly Book[];
  /** The active order, in priority order. */
  sort: readonly SortCriterion[];
  onSort: (field: SortField) => void;
  /** A new page is on its way; the table shows the previous one meanwhile. */
  busy: boolean;
}

const ARIA_SORT = { asc: 'ascending', desc: 'descending' } as const;
const ARROW = { asc: '↑', desc: '↓' } as const;

function SortHeader({
  column,
  sort,
  onSort,
}: {
  column: Column;
  sort: readonly SortCriterion[];
  onSort: (field: SortField) => void;
}) {
  const index = sort.findIndex((criterion) => criterion.field === column.field);
  const criterion = sort[index];

  return (
    <th
      scope="col"
      aria-sort={criterion ? ARIA_SORT[criterion.direction] : 'none'}
      className={`px-3 py-2 text-sm font-semibold text-slate-700 ${column.align === 'right' ? 'text-right' : 'text-left'}`}
    >
      <button
        type="button"
        onClick={() => onSort(column.field)}
        className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-slate-100 focus:outline-2 focus:outline-blue-700"
      >
        {column.label}
        {criterion ? (
          <span aria-hidden="true" className="text-blue-700">
            {ARROW[criterion.direction]}
            {/* The number of the criterion tells the priority when there are several. */}
            {sort.length > 1 && <sup>{index + 1}</sup>}
          </span>
        ) : (
          <span aria-hidden="true" className="text-slate-300">
            ↕
          </span>
        )}
      </button>
    </th>
  );
}

/** The books of one page, with headers that order the listing when pressed. */
export function BookTable({ books, sort, onSort, busy }: BookTableProps) {
  // The covers that did not load. A row only gives up its own picture and
  // download, and a new upload has another URL, so it is tried again.
  const [brokenCovers, setBrokenCovers] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const markBroken = (imageUrl: string) =>
    setBrokenCovers((current) => new Set(current).add(imageUrl));

  return (
    // `relative`: the hidden text of the download header (`sr-only` is absolute) is
    // then clipped with the rest of the table instead of widening the whole page.
    // The scroll is only the last resort (a phone): the text cells break long
    // words (`wrap-anywhere`), so a title without spaces cannot stretch the columns.
    <div className="relative overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table aria-busy={busy} className="min-w-full divide-y divide-slate-200">
        <caption className="sr-only">Libros</caption>
        <thead className="bg-slate-50">
          <tr>
            {/* Not sortable: the API does not order by "has a cover". */}
            <th
              scope="col"
              className="px-3 py-2 text-left text-sm font-semibold text-slate-700"
            >
              Portada
            </th>
            {COLUMNS.map((column) => (
              <SortHeader
                key={column.field}
                column={column}
                sort={sort}
                onSort={onSort}
              />
            ))}
            <th scope="col" className="px-3 py-2">
              <span className="sr-only">Descargar portada</span>
            </th>
          </tr>
        </thead>
        <tbody
          className={`divide-y divide-slate-100 ${busy ? 'opacity-60' : ''}`}
        >
          {books.map((book) => {
            const broken =
              book.imageUrl !== null && brokenCovers.has(book.imageUrl);
            // What is on screen: nothing to show or download when it did not load.
            const cover = broken ? null : book.imageUrl;
            return (
              <tr key={book.id}>
                <td className="px-3 py-2">
                  <BookCoverCell
                    title={book.title}
                    imageUrl={cover}
                    broken={broken}
                    onError={markBroken}
                  />
                </td>
                <td className="px-3 py-2 wrap-anywhere">
                  <Link
                    to={`/books/${book.id}`}
                    className="font-medium text-blue-700 underline-offset-2 hover:underline"
                  >
                    {book.title}
                  </Link>
                </td>
                <td className="px-3 py-2 text-slate-700 wrap-anywhere">
                  {book.author}
                </td>
                <td className="px-3 py-2 text-slate-700 wrap-anywhere">
                  {book.publisher}
                </td>
                <td className="px-3 py-2 text-slate-700 wrap-anywhere">
                  {book.genre}
                </td>
                <td className="px-3 py-2 text-right text-slate-900">
                  {formatPrice(book.price)}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={
                      book.availability
                        ? 'rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800'
                        : 'rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700'
                    }
                  >
                    {book.availability ? 'Disponible' : 'No disponible'}
                  </span>
                </td>
                <td className="px-3 py-2 text-sm text-slate-600">
                  {formatDateTime(book.createdAt)}
                </td>
                <td className="px-3 py-2 text-right">
                  <BookDownloadCell title={book.title} imageUrl={cover} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
