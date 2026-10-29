import type { BookDto } from '../dto/book.dto';

/**
 * Marks the file as UTF-8. Without it Excel reads the bytes as a legacy code
 * page and shows "Ã±" for "ñ" and "Ã©" for "é".
 */
export const CSV_BOM = '﻿';

/** The columns of the export, in Spanish: the file is for the people of the store. */
export const CSV_HEADERS = [
  'ID',
  'Título',
  'Autor',
  'Editorial',
  'Género',
  'Precio',
  'Disponible',
  'Registrado',
  'Actualizado',
] as const;

// What a spreadsheet reads as the start of a formula (OWASP "CSV injection").
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * A text cell that a spreadsheet will show as text. A title such as
 * `=HYPERLINK("http://evil.test","click")` would otherwise run when someone
 * opens the file, so a cell that starts like a formula gets a single quote in
 * front (conventions.md). Only text is touched: numbers and dates are ours.
 */
export const escapeCsvCell = (text: string): string =>
  FORMULA_START.test(text) ? `'${text}` : text;

/**
 * One book as the cells of a row, in the order of `CSV_HEADERS`. The price is a
 * plain number with a decimal point (it reads the same in any tool), the dates
 * are ISO 8601 in UTC, and the cover URL and `deletedAt` are not exported.
 */
export function toCsvRow(book: BookDto): string[] {
  return [
    book.id,
    escapeCsvCell(book.title),
    escapeCsvCell(book.author),
    escapeCsvCell(book.publisher),
    escapeCsvCell(book.genre),
    String(book.price),
    book.availability ? 'Sí' : 'No',
    book.createdAt.toISOString(),
    book.updatedAt.toISOString(),
  ];
}

/** `libros-2026-10-29.csv`: the day in UTC, the same in every environment. */
export const csvFileName = (date: Date): string =>
  `libros-${date.toISOString().slice(0, 10)}.csv`;
