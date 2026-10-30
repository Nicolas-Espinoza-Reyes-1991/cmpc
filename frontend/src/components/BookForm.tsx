import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch, type DefaultValues } from 'react-hook-form';
import { Link } from 'react-router';
import {
  ApiError,
  getErrorMessage,
  SERVER_FIELD_MESSAGE,
} from '../lib/api-error';
import { FormMessageError } from '../lib/form-message-error';
import { bookSchema, type BookFormValues } from '../lib/book-schema';
import type { ImageChoice } from '../types/book';
import { CatalogField } from './CatalogField';
import { errorAttributes, INPUT_CLASSES } from '../lib/form-attributes';
import { FormField } from './FormField';
import { ImageField } from './ImageField';

const DUPLICATE_MESSAGE =
  'Ya existe un libro con el mismo título, autor y editorial.';

const FIELDS = [
  'title',
  'author',
  'publisher',
  'genre',
  'price',
  'availability',
] as const;
type Field = (typeof FIELDS)[number];

const isField = (name: string): name is Field =>
  FIELDS.some((field) => field === name);

interface BookFormProps {
  defaultValues: DefaultValues<BookFormValues>;
  submitLabel: string;
  /** Where "Cancelar" goes. */
  cancelTo: string;
  /** The cover the book has now (editing), to show and to remove. */
  currentImageUrl?: string | null;
  /** Saves the book and what was decided about the cover. A rejection is shown by the form itself. */
  onSubmit: (values: BookFormValues, image: ImageChoice) => Promise<void>;
}

/**
 * The book form, shared by "new" and "edit". Like the login, it shows its own
 * errors: a 400 goes to its field, a 409 under the form, and anything else as
 * a message. It calls `onSubmit` directly instead of a TanStack mutation, so
 * the global notice never repeats them (C8.5).
 */
export function BookForm({
  defaultValues,
  submitLabel,
  cancelTo,
  currentImageUrl = null,
  onSubmit,
}: BookFormProps) {
  // Problems that do not belong to one field: a duplicate, the network, a 5xx...
  const [formError, setFormError] = useState<string | null>(null);
  // The cover is not a value of the form (a File is not), so it is kept next to it.
  const [imageChoice, setImageChoice] = useState<ImageChoice>({
    image: null,
    removeImage: false,
  });

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<BookFormValues>({
    resolver: zodResolver(bookSchema),
    // Validates when a field loses focus and, once it has an error, on every change.
    mode: 'onTouched',
    defaultValues,
  });

  // What the user typed in the catalog fields, to ask for suggestions.
  const author = useWatch({ control, name: 'author' });
  const publisher = useWatch({ control, name: 'publisher' });
  const genre = useWatch({ control, name: 'genre' });

  function showFailure(error: unknown): void {
    // A message already written for the user (a partial save) is shown as it is.
    if (error instanceof FormMessageError) {
      setFormError(error.message);
      return;
    }
    if (!(error instanceof ApiError)) {
      setFormError(getErrorMessage(error));
      return;
    }

    // Only the errors of fields this form has; flatMap narrows the name to `Field`.
    const fieldErrors = error.fieldErrors.flatMap(({ field }) =>
      isField(field) ? [{ field, message: SERVER_FIELD_MESSAGE }] : [],
    );
    if (error.status === 400 && fieldErrors.length > 0) {
      for (const { field, message } of fieldErrors) {
        setError(field, { type: 'server', message });
      }
      return;
    }

    setFormError(error.status === 409 ? DUPLICATE_MESSAGE : error.message);
  }

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await onSubmit(values, imageChoice);
    } catch (error) {
      showFailure(error);
    }
  });

  return (
    <form
      onSubmit={(event) => {
        // handleSubmit returns a promise; React only needs the event handled.
        void submit(event);
      }}
      noValidate
      aria-busy={isSubmitting}
      className="space-y-5"
    >
      {formError && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {formError}
        </div>
      )}

      <FormField id="title" label="Título" error={errors.title?.message}>
        <input
          id="title"
          type="text"
          autoFocus
          className={INPUT_CLASSES}
          {...errorAttributes('title', errors.title?.message)}
          {...register('title')}
        />
      </FormField>

      <CatalogField
        kind="authors"
        label="Autor"
        value={author}
        error={errors.author?.message}
        registration={register('author')}
      />
      <CatalogField
        kind="publishers"
        label="Editorial"
        value={publisher}
        error={errors.publisher?.message}
        registration={register('publisher')}
      />
      <CatalogField
        kind="genres"
        label="Género"
        value={genre}
        error={errors.genre?.message}
        registration={register('genre')}
      />

      <FormField id="price" label="Precio" error={errors.price?.message}>
        <input
          id="price"
          type="number"
          inputMode="decimal"
          step="0.01"
          className={INPUT_CLASSES}
          {...errorAttributes('price', errors.price?.message)}
          // An empty box becomes NaN, which the schema answers in Spanish.
          {...register('price', { valueAsNumber: true })}
        />
      </FormField>

      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            className="size-4 rounded border-slate-300"
            {...register('availability')}
          />
          Disponible
        </label>
        {errors.availability && (
          <p className="mt-1 text-sm text-red-700">
            {errors.availability.message}
          </p>
        )}
      </div>

      <ImageField
        currentUrl={currentImageUrl}
        choice={imageChoice}
        onChange={setImageChoice}
      />

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-blue-700 px-4 py-2 font-medium text-white hover:bg-blue-800 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
        >
          {isSubmitting ? 'Guardando…' : submitLabel}
        </button>
        <Link
          to={cancelTo}
          className="rounded-md px-4 py-2 text-slate-700 underline hover:text-slate-900"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
