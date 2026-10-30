import { useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { BookNotFound } from '../components/BookNotFound';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CoverDownload } from '../components/CoverDownload';
import { CoverPreview } from '../components/CoverPreview';
import { bookKey, useBook } from '../hooks/useBook';
import { getErrorMessage } from '../lib/api-error';
import { isMissingBook } from '../lib/book-errors';
import { formatDateTime, formatPrice } from '../lib/format';
import { deleteBook } from '../services/books.service';
import type { Book } from '../types/book';

function Page({ children }: { children: ReactNode }) {
  return <main className="mx-auto max-w-3xl p-8">{children}</main>;
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-slate-900">{children}</dd>
    </div>
  );
}

/** Same size for the thumbnail and the placeholder, so the page does not move. */
const COVER_SIZE = 'mx-auto aspect-[2/3] w-40 sm:w-full';

/** `broken` is set by the page when the cover file fails to load. */
function Cover({
  book,
  broken,
  onError,
}: {
  book: Book;
  broken: boolean;
  onError: () => void;
}) {
  if (book.imageUrl && !broken) {
    return (
      <CoverPreview src={book.imageUrl} title={book.title} onError={onError} />
    );
  }
  return (
    <div
      role="img"
      aria-label={
        broken
          ? 'La portada no se pudo cargar'
          : 'Este libro todavía no tiene portada'
      }
      className={`${COVER_SIZE} flex items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-100 text-sm text-slate-500`}
    >
      Sin portada
    </div>
  );
}

function BookDetail({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: book, error, isPending, refetch } = useBook(id);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // The cover URL that failed to load. A new upload has another URL, so it is tried again.
  const [brokenCover, setBrokenCover] = useState<string | null>(null);

  if (isPending) {
    return (
      <Page>
        <p role="status" className="text-slate-600">
          Cargando libro…
        </p>
      </Page>
    );
  }

  if (error) {
    if (isMissingBook(error)) return <BookNotFound />;
    return (
      <Page>
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
      </Page>
    );
  }

  const closeDialog = () => {
    setConfirming(false);
    setDeleteError(null);
  };

  const remove = async (): Promise<void> => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteBook(id);
    } catch (failure) {
      // Stay on the book with the dialog open so the user can try again.
      setDeleteError(getErrorMessage(failure));
      setDeleting(false);
      return;
    }
    queryClient.removeQueries({ queryKey: bookKey(id) });
    void queryClient.invalidateQueries({ queryKey: ['books'] });
    void navigate('/books');
  };

  const coverBroken = book.imageUrl !== null && brokenCover === book.imageUrl;

  return (
    <Page>
      <div className="grid gap-8 sm:grid-cols-[12rem_1fr]">
        <Cover
          book={book}
          broken={coverBroken}
          onError={() => setBrokenCover(book.imageUrl)}
        />

        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {book.title}
          </h1>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <Detail label="Autor">{book.author}</Detail>
            <Detail label="Editorial">{book.publisher}</Detail>
            <Detail label="Género">{book.genre}</Detail>
            <Detail label="Precio">{formatPrice(book.price)}</Detail>
            <Detail label="Disponibilidad">
              <span
                className={
                  book.availability
                    ? 'rounded-full bg-green-100 px-2 py-0.5 text-sm font-medium text-green-800'
                    : 'rounded-full bg-slate-200 px-2 py-0.5 text-sm font-medium text-slate-700'
                }
              >
                {book.availability ? 'Disponible' : 'No disponible'}
              </span>
            </Detail>
            <Detail label="Registrado">{formatDateTime(book.createdAt)}</Detail>
            <Detail label="Última edición">
              {formatDateTime(book.updatedAt)}
            </Detail>
          </dl>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to={`/books/${id}/edit`}
              className="rounded-md bg-blue-700 px-4 py-2 font-medium text-white hover:bg-blue-800 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700"
            >
              Editar
            </Link>
            {book.imageUrl && !coverBroken && (
              <CoverDownload src={book.imageUrl} title={book.title} />
            )}
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded-md border border-red-300 px-4 py-2 font-medium text-red-700 hover:bg-red-50 focus:outline-2 focus:outline-offset-2 focus:outline-red-700"
            >
              Eliminar
            </button>
            <Link
              to="/books"
              className="rounded-md px-4 py-2 text-slate-700 underline hover:text-slate-900"
            >
              Volver a los libros
            </Link>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Eliminar libro"
        message={`¿Eliminar «${book.title}»? Dejará de aparecer en el listado.`}
        confirmLabel="Eliminar"
        busyLabel="Eliminando…"
        busy={deleting}
        error={deleteError}
        onConfirm={() => void remove()}
        onCancel={closeDialog}
      />
    </Page>
  );
}

/** `/books/:id`: every field of one book, with the way to edit or delete it. */
export function BookDetailPage() {
  const { id } = useParams();
  // The route always has an `:id`; without it there is nothing to show.
  return id === undefined ? <BookNotFound /> : <BookDetail id={id} />;
}
