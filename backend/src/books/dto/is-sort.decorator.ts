import { ValidateBy, ValidationOptions } from 'class-validator';
import { parseSort } from '../book-list.query';

const FALLBACK_MESSAGE = 'sort is not valid';

/** Why `value` is not a valid `sort`, in the words of `parseSort`. */
export function sortMessage(value: unknown): string {
  if (typeof value !== 'string') return FALLBACK_MESSAGE;
  const parsed = parseSort(value);
  return parsed.ok ? FALLBACK_MESSAGE : parsed.reason;
}

/**
 * Checks a `sort` text with the same function the listing uses to read it, so
 * the error reaches the client under the field `sort` and says what is wrong
 * (an unknown field, a repeated one, too many criteria).
 */
export function IsSort(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isSort',
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && parseSort(value).ok,
        defaultMessage: (args) => sortMessage(args?.value),
      },
    },
    validationOptions,
  );
}
