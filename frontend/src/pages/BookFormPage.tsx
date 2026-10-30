import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router';
import { BookForm } from '../components/BookForm';
import { BookNotFound } from '../components/BookNotFound';
import { bookKey, useBook } from '../hooks/useBook';
import { useListingPath } from '../hooks/useListingPath';
import { ApiError, getErrorMessage } from '../lib/api-error';
import type { BookFormValues } from '../lib/book-schema';
import { changedFields } from '../lib/book-changes';
import { isMissingBook } from '../lib/book-errors';
import { FormMessageError } from '../lib/form-message-error';
import {
  createBook,
  deleteBookImage,
  updateBook,
  uploadBookImage,
} from '../services/books.service';
import type { Book, ImageChoice } from '../types/book';

/** What a saved book changes in the app: its cache, the lists and the catalogs. */
function useAfterSave() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return (book: Book, destination?: { to: string; state?: unknown }): void => {
    queryClient.setQueryData(bookKey(book.id), book);
    // Every list of books is stale now; the book just saved is already up to date.
    void queryClient.invalidateQueries({
      queryKey: ['books'],
      predicate: (query) => query.queryKey[1] !== book.id,
    });
    // The save may have created an author, a publisher or a genre.
    void queryClient.invalidateQueries({ queryKey: ['catalog'] });
    void navigate(destination?.to ?? `/books/${book.id}`, {
      state: destination?.state,
    });
  };
}

function Page({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      <div className="mt-6">{children}</div>
    </main>
  );
}

function CreateBook() {
  const afterSave = useAfterSave();
  const listingPath = useListingPath();

  return (
    <Page title="Nuevo libro">
      <BookForm
        // The price starts empty, not 0: a forgotten price must be noticed.
        defaultValues={{
          title: '',
          author: '',
          publisher: '',
          genre: '',
          availability: true,
        }}
        submitLabel="Registrar libro"
        cancelTo={listingPath}
        onSubmit={async (values, { image }) => {
          const created = await createBook(values);
          if (!image) {
            afterSave(created);
            return;
          }
          try {
            afterSave(await uploadBookImage(created.id, image));
          } catch (error) {
            // The book exists now: retrying here would create a duplicate (409).
            // Go to its edit screen, where the cover can be tried again.
            afterSave(created, {
              to: `/books/${created.id}/edit`,
              state: { imageError: coverErrorMessage(error) },
            });
          }
        }}
      />
    </Page>
  );
}

/**
 * Why a cover could not be saved, in words about the cover. A 400 here can only
 * mean the content is not a JPEG, PNG or WebP (the browser went by the file
 * name; the server looks inside), and the generic "invalid data" says nothing.
 */
function coverErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 400) {
    return 'El archivo no es una imagen válida: usa un JPG, PNG o WebP.';
  }
  return getErrorMessage(error);
}

/**
 * The notice a creation leaves when the book was saved but its cover was not
 * (route state travels as `unknown`).
 */
function readImageError(state: unknown): string | null {
  if (
    typeof state === 'object' &&
    state !== null &&
    'imageError' in state &&
    typeof state.imageError === 'string'
  ) {
    return state.imageError;
  }
  return null;
}

function EditBook({ id }: { id: string }) {
  const afterSave = useAfterSave();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const imageError = readImageError(useLocation().state);
  const { data: book, error, isPending, refetch } = useBook(id);

  if (isPending) {
    return (
      <Page title="Editar libro">
        <p role="status" className="text-slate-600">
          Cargando libro…
        </p>
      </Page>
    );
  }

  if (error) {
    if (isMissingBook(error)) return <BookNotFound />;
    return (
      <Page title="Editar libro">
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

  const save = async (
    values: BookFormValues,
    { image, removeImage }: ImageChoice,
  ): Promise<void> => {
    const changes = changedFields(book, values);
    const dataChanged = Object.keys(changes).length > 0;
    const coverChanged = image !== null || removeImage;
    // Nothing to save: the API would answer 400 to an empty update, so just go back.
    if (!dataChanged && !coverChanged) {
      void navigate(`/books/${id}`);
      return;
    }

    let saved = book;
    if (dataChanged) saved = await updateBook(id, changes);
    if (coverChanged) {
      try {
        saved = image
          ? await uploadBookImage(id, image)
          : await deleteBookImage(id);
      } catch (error) {
        if (!dataChanged) throw new FormMessageError(coverErrorMessage(error));
        // The data went through. Keep it in the cache, so a retry has nothing
        // left to send but the cover, and say clearly what happened.
        queryClient.setQueryData(bookKey(id), saved);
        throw new FormMessageError(
          `Los datos se guardaron, pero la portada no se pudo actualizar: ${coverErrorMessage(error)}`,
        );
      }
    }
    afterSave(saved);
  };

  return (
    <Page title="Editar libro">
      {imageError && (
        <p
          role="alert"
          className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          El libro se guardó, pero la portada no se pudo subir: {imageError}{' '}
          Elige la imagen de nuevo y guarda.
        </p>
      )}
      <BookForm
        defaultValues={{
          title: book.title,
          author: book.author,
          publisher: book.publisher,
          genre: book.genre,
          price: book.price,
          availability: book.availability,
        }}
        submitLabel="Guardar cambios"
        cancelTo={`/books/${id}`}
        currentImageUrl={book.imageUrl}
        onSubmit={save}
      />
    </Page>
  );
}

/** `/books/new` creates a book; `/books/:id/edit` changes one. */
export function BookFormPage() {
  const { id } = useParams();
  return id === undefined ? <CreateBook /> : <EditBook id={id} />;
}
