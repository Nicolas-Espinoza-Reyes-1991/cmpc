import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import { BookForm } from '../components/BookForm';
import { BookNotFound } from '../components/BookNotFound';
import { bookKey, useBook } from '../hooks/useBook';
import type { BookFormValues } from '../lib/book-schema';
import { changedFields } from '../lib/book-changes';
import { isMissingBook } from '../lib/book-errors';
import { createBook, updateBook } from '../services/books.service';
import type { Book } from '../types/book';

/** What a saved book changes in the app: its cache, the lists and the catalogs. */
function useAfterSave() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return (book: Book): void => {
    queryClient.setQueryData(bookKey(book.id), book);
    // Every list of books is stale now; the book just saved is already up to date.
    void queryClient.invalidateQueries({
      queryKey: ['books'],
      predicate: (query) => query.queryKey[1] !== book.id,
    });
    // The save may have created an author, a publisher or a genre.
    void queryClient.invalidateQueries({ queryKey: ['catalog'] });
    void navigate(`/books/${book.id}`);
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
        cancelTo="/books"
        onSubmit={async (values) => {
          afterSave(await createBook(values));
        }}
      />
    </Page>
  );
}

function EditBook({ id }: { id: string }) {
  const afterSave = useAfterSave();
  const navigate = useNavigate();
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

  const save = async (values: BookFormValues): Promise<void> => {
    const changes = changedFields(book, values);
    // Nothing changed: the API would answer 400 to an empty update, so just go back.
    if (Object.keys(changes).length === 0) {
      void navigate(`/books/${id}`);
      return;
    }
    afterSave(await updateBook(id, changes));
  };

  return (
    <Page title="Editar libro">
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
