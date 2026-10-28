import { useId } from 'react';
import { useUrlBoundText } from '../hooks/useUrlBoundText';
import { INPUT_CLASSES } from '../lib/form-attributes';
import type { BookListParams, CatalogKind } from '../types/book';
import { CatalogOptions } from './CatalogOptions';

type TextFilter = 'search' | 'author' | 'publisher' | 'genre';

interface BookFiltersProps {
  params: Pick<BookListParams, TextFilter | 'availability'>;
  /** Text filters are typed one letter at a time: they replace the history entry. */
  onChange: (
    changes: Partial<Pick<BookListParams, TextFilter | 'availability'>>,
    options?: { replace?: boolean },
  ) => void;
  onClear: () => void;
  /** Whether something narrows the listing now (to offer "Limpiar filtros"). */
  active: boolean;
}

interface TextBoxProps {
  label: string;
  type?: 'search' | 'text';
  value: string;
  onCommit: (text: string) => void;
  /** Catalog whose names are suggested while typing. */
  suggestions?: CatalogKind;
}

function TextBox({
  label,
  type = 'text',
  value,
  onCommit,
  suggestions,
}: TextBoxProps) {
  const id = useId();
  const listId = `${id}-options`;
  const [text, setText] = useUrlBoundText(value, onCommit);

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={text}
        onChange={(event) => setText(event.target.value)}
        list={suggestions ? listId : undefined}
        autoComplete="off"
        className={INPUT_CLASSES}
      />
      {suggestions && (
        <CatalogOptions id={listId} kind={suggestions} text={text} />
      )}
    </div>
  );
}

const AVAILABILITY_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'true', label: 'Disponibles' },
  { value: 'false', label: 'No disponibles' },
] as const;

const availabilityValue = (availability: boolean | undefined): string =>
  availability === undefined ? 'all' : String(availability);

/**
 * The search by title and the filters of the listing. The text boxes wait for
 * the user to pause before touching the URL; the availability menu applies at once.
 */
export function BookFilters({
  params,
  onChange,
  onClear,
  active,
}: BookFiltersProps) {
  const availabilityId = useId();

  return (
    <section
      aria-label="Búsqueda y filtros"
      className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div className="sm:col-span-2 lg:col-span-4">
        <TextBox
          label="Buscar por título"
          type="search"
          value={params.search}
          onCommit={(text) => onChange({ search: text }, { replace: true })}
        />
      </div>
      <TextBox
        label="Autor"
        value={params.author}
        suggestions="authors"
        onCommit={(text) => onChange({ author: text }, { replace: true })}
      />
      <TextBox
        label="Editorial"
        value={params.publisher}
        suggestions="publishers"
        onCommit={(text) => onChange({ publisher: text }, { replace: true })}
      />
      <TextBox
        label="Género"
        value={params.genre}
        suggestions="genres"
        onCommit={(text) => onChange({ genre: text }, { replace: true })}
      />
      <div>
        <label
          htmlFor={availabilityId}
          className="block text-sm font-medium text-slate-700"
        >
          Disponibilidad
        </label>
        <select
          id={availabilityId}
          value={availabilityValue(params.availability)}
          onChange={(event) =>
            onChange({
              availability:
                event.target.value === 'all'
                  ? undefined
                  : event.target.value === 'true',
            })
          }
          className={INPUT_CLASSES}
        >
          {AVAILABILITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {active && (
        <div className="sm:col-span-2 lg:col-span-4">
          <button
            type="button"
            onClick={onClear}
            className="text-sm font-medium text-blue-700 underline"
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </section>
  );
}
