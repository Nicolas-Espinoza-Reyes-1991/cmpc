/** Classes of every text-like input of the forms. */
export const INPUT_CLASSES =
  'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-blue-600 focus:outline-2 focus:outline-blue-600 aria-[invalid=true]:border-red-600';

/** Id of the message that explains why a field is invalid. */
export const errorId = (id: string): string => `${id}-error`;

/** The attributes that tie an input to its error message, for screen readers. */
export const errorAttributes = (id: string, error: string | undefined) => ({
  'aria-invalid': Boolean(error),
  'aria-describedby': error ? errorId(id) : undefined,
});
