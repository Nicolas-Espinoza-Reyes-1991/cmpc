import { useId } from 'react';
import { PAGE_SIZES } from '../lib/book-list-params';

interface PaginationProps {
  page: number;
  limit: number;
  /** Results that match the filters, not just this page. */
  total: number;
  onPage: (page: number) => void;
  onLimit: (limit: number) => void;
}

const buttonClasses =
  'rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 focus:outline-2 focus:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent';

/** Previous and next, where the user is, and how many books to show per page. */
export function Pagination({
  page,
  limit,
  total,
  onPage,
  onLimit,
}: PaginationProps) {
  const sizeId = useId();
  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <nav
      aria-label="Paginación"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <div className="flex items-center gap-2">
        <label htmlFor={sizeId} className="text-sm text-slate-600">
          Libros por página
        </label>
        <select
          id={sizeId}
          value={limit}
          onChange={(event) => onLimit(Number(event.target.value))}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className={buttonClasses}
        >
          Anterior
        </button>
        <span className="text-sm text-slate-700">
          Página {page} de {pages}
        </span>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          className={buttonClasses}
        >
          Siguiente
        </button>
      </div>
    </nav>
  );
}
