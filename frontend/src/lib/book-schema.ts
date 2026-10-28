import { z } from 'zod';

/** Limits of the book fields. They mirror the backend's `CreateBookDto`. */
export const TITLE_MAX_LENGTH = 200;
export const NAME_MAX_LENGTH = 100;
export const PRICE_MAX = 99_999_999.99;
export const PRICE_MIN = 0.01;
// Floats carry rounding noise (12990.1 * 100 = 1299010.0000000002).
const CENTS_TOLERANCE = 1e-5;

const PRICE_INVALID = 'Ingresa un precio válido.';

/**
 * The first rule a price breaks, in Spanish, or `undefined` when it is valid.
 * Same rule as the backend's `isMoney` (0.01 up to the maximum, two decimals at
 * most), told apart so the user learns which part to fix.
 */
export function priceProblem(value: number): string | undefined {
  if (value <= 0) return 'El precio debe ser mayor que 0.';
  if (value < PRICE_MIN) return 'El precio mínimo es 0,01.';
  if (value > PRICE_MAX) {
    return `El precio no puede superar ${PRICE_MAX.toLocaleString('es-CL')}.`;
  }
  const cents = value * 100;
  if (Math.abs(cents - Math.round(cents)) >= CENTS_TOLERANCE) {
    return 'El precio admite como máximo dos decimales.';
  }
  return undefined;
}

/** Trim and collapse repeated spaces, as the API does, so what is seen is what is saved. */
export const normalizeText = (value: string): string =>
  value.trim().replace(/\s+/g, ' ');

const text = (label: string, max: number, requiredMessage: string) =>
  z
    .string({ error: requiredMessage })
    .transform(normalizeText)
    // The transform runs first so a length counts the text as it will be saved.
    .pipe(
      z
        .string()
        .min(1, requiredMessage)
        .max(max, `${label} no puede superar los ${max} caracteres.`),
    );

/**
 * Validation of the book form, in Spanish and before sending anything. The form
 * may be stricter than the API, never more permissive. `price` arrives as a
 * number (`valueAsNumber`): an empty box is `NaN`, which gets its own message.
 * A price reports only the first rule it breaks.
 */
export const bookSchema = z.object({
  title: text('El título', TITLE_MAX_LENGTH, 'Ingresa el título.'),
  author: text('El autor', NAME_MAX_LENGTH, 'Ingresa el autor.'),
  publisher: text('La editorial', NAME_MAX_LENGTH, 'Ingresa la editorial.'),
  genre: text('El género', NAME_MAX_LENGTH, 'Ingresa el género.'),
  // `z.number` already rejects NaN (an empty box) and Infinity with this message.
  price: z.number({ error: PRICE_INVALID }).superRefine((value, ctx) => {
    const problem = priceProblem(value);
    if (problem) ctx.addIssue({ code: 'custom', message: problem });
  }),
  availability: z.boolean({ error: 'Indica si el libro está disponible.' }),
});

export type BookFormValues = z.infer<typeof bookSchema>;
