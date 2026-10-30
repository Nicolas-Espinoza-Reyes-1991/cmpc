import { useEffect } from 'react';
import { Link } from 'react-router';
import { BookFilters } from '../components/BookFilters';
import { BookTable } from '../components/BookTable';
import { Pagination } from '../components/Pagination';
import { useBookListParams } from '../hooks/useBookListParams';
import { useBooks } from '../hooks/useBooks';
import { useExportBooks } from '../hooks/useExportBooks';
import { hasActiveFilters } from '../lib/book-list-params';
import type { ExportFormat } from '../services/books.service';

/** Excel first: it opens with every field in its own column in any language. */
const EXPORT_BUTTONS: { format: ExportFormat; label: string }[] = [
  { format: 'xlsx', label: 'Exportar Excel' },
  { format: 'csv', label: 'Exportar CSV' },
];

const FORMAT_NAMES: Record<ExportFormat, string> = {
  csv: 'CSV',
  xlsx: 'Excel',
};

/**
 * The books of the store: search by title, filters, order by several columns
 * and pagination, all resolved by the server. The view lives in the URL, so
 * reloading, going back and sharing the link keep it.
 */
export function BooksPage() {
  const { params, change, goToPage, toggleSort, clearSort, clearFilters } =
    useBookListParams();
  const { data, error, isPending, isPlaceholderData, refetch } =
    useBooks(params);
  const exporter = useExportBooks(params);
  // Read once: inside the notice it is known to be set, also in its click handler.
  const { failedFormat } = exporter;
  const filtersActive = hasActiveFilters(params);

  const total = data?.meta.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / params.limit));

  // A shared link, a deletion or a bigger page size can leave the URL on a page
  // that does not exist anymore: show the last one instead of an empty table.
  useEffect(() => {
    if (data && !isPlaceholderData && params.page > lastPage) {
      goToPage(lastPage, { replace: true });
    }
  }, [data, isPlaceholderData, params.page, lastPage, goToPage]);

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">Libros</h1>
        <div className="flex items-center gap-3">
          {EXPORT_BUTTONS.map(({ format, label }) => (
            <button
              key={format}
              type="button"
              onClick={() => exporter.exportFile(format)}
              disabled={exporter.isExporting}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 font-medium text-slate-800 hover:bg-slate-50 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700 disabled:cursor-wait disabled:opacity-60"
            >
              {exporter.exportingFormat === format ? 'Exportando…' : label}
            </button>
          ))}
          <Link
            to="/books/new"
            className="rounded-md bg-blue-700 px-4 py-2 font-medium text-white hover:bg-blue-800 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700"
          >
            Nuevo libro
          </Link>
        </div>
      </div>

      {exporter.error && failedFormat && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800"
        >
          <p>
            No se pudo exportar el {FORMAT_NAMES[failedFormat]}.{' '}
            {exporter.error.message}
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={() => exporter.exportFile(failedFormat)}
              className="rounded bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
            >
              Reintentar exportación
            </button>
            <button
              type="button"
              onClick={exporter.dismiss}
              className="rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
            >
              Cerrar aviso
            </button>
          </div>
        </div>
      )}

      <BookFilters
        params={params}
        onChange={change}
        onClear={clearFilters}
        active={filtersActive}
      />

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800"
        >
          <p>{error.message}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-3 rounded bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
          >
            Reintentar
          </button>
        </div>
      )}

      {isPending && !error && (
        <p role="status" className="text-slate-600">
          Cargando libros…
        </p>
      )}

      {data && (
        <>
          <div className="flex items-center justify-between gap-4">
            <p role="status" className="text-sm text-slate-600">
              {total} {total === 1 ? 'resultado' : 'resultados'}
            </p>
            {params.sort.length > 0 && (
              <button
                type="button"
                onClick={clearSort}
                className="text-sm font-medium text-blue-700 underline"
              >
                Quitar orden
              </button>
            )}
          </div>

          {data.items.length > 0 ? (
            <BookTable
              books={data.items}
              sort={params.sort}
              onSort={toggleSort}
              busy={isPlaceholderData}
            />
          ) : (
            <div className="rounded-md border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
              {filtersActive ? (
                <p>
                  Ningún libro coincide con los filtros. Usa «Limpiar filtros»
                  para ver todos.
                </p>
              ) : (
                <>
                  <p>No hay libros todavía.</p>
                  <Link
                    to="/books/new"
                    className="mt-2 inline-block text-blue-700 underline"
                  >
                    Registrar el primer libro
                  </Link>
                </>
              )}
            </div>
          )}

          <Pagination
            page={params.page}
            limit={params.limit}
            total={total}
            onPage={goToPage}
            onLimit={(limit) => change({ limit })}
          />
        </>
      )}
    </main>
  );
}
