import type { UseFormRegisterReturn } from 'react-hook-form';
import { useCatalogOptions } from '../hooks/useCatalogOptions';
import type { CatalogKind } from '../types/book';
import { errorAttributes, INPUT_CLASSES } from '../lib/form-attributes';
import { FormField } from './FormField';

interface CatalogFieldProps {
  kind: CatalogKind;
  label: string;
  /** What the user has typed so far; the suggestions are searched with it. */
  value: string;
  error: string | undefined;
  /** The result of `register(...)` for this field. */
  registration: UseFormRegisterReturn;
}

/**
 * A text field that suggests existing names but accepts any: a name that does
 * not exist yet is created when the book is saved. The native `<datalist>`
 * does the suggesting, so no component library is needed.
 */
export function CatalogField({
  kind,
  label,
  value,
  error,
  registration,
}: CatalogFieldProps) {
  const id = registration.name;
  const listId = `${id}-options`;
  const { data } = useCatalogOptions(kind, value);

  return (
    <FormField id={id} label={label} error={error}>
      <input
        id={id}
        type="text"
        list={listId}
        autoComplete="off"
        className={INPUT_CLASSES}
        {...errorAttributes(id, error)}
        {...registration}
      />
      <datalist id={listId}>
        {data?.map((item) => (
          <option key={item.id} value={item.name} />
        ))}
      </datalist>
    </FormField>
  );
}
