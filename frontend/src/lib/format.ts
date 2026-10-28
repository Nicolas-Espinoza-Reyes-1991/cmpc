const LOCALE = 'es-CL';

/**
 * Price as Chilean pesos: "$12.990", or "$9.990,50" when it has cents. The
 * currency is a presentation assumption; the stored price carries none.
 */
export function formatPrice(price: number): string {
  const digits = Number.isInteger(price) ? 0 : 2;
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(price);
}

/** "28-10-2026, 10:30 a. m." (Chilean format). `timeZone` is for tests; the app uses the browser's. */
export function formatDateTime(value: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(value));
}
