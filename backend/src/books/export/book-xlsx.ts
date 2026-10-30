import writeXlsxFile, {
  type Column,
  type SheetData,
} from 'write-excel-file/node';
import type { BookDto } from '../dto/book.dto';
import { CSV_HEADERS } from './book-csv';

/**
 * The most books an Excel file is built for. The library builds the whole
 * workbook in memory (about 130 MB and one second for this many rows), so the
 * limit keeps one request from exhausting the server. The CSV has no limit
 * because it is streamed.
 */
export const XLSX_MAX_ROWS = 20_000;

export const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const SHEET_NAME = 'Libros';

/** `libros-2026-10-29.xlsx`: the day in UTC, the same in every environment. */
export const xlsxFileName = (date: Date): string =>
  `libros-${date.toISOString().slice(0, 10)}.xlsx`;

const header = (index: number) => ({
  value: CSV_HEADERS[index],
  fontWeight: 'bold' as const,
});

const MONEY_FORMAT = '#,##0.00';
const DATE_FORMAT = 'yyyy-mm-dd hh:mm:ss';

/**
 * One column per field, in the order of the CSV. Text goes in as text, so a
 * title such as `=HYPERLINK(...)` is shown as it is and never evaluated (the CSV
 * needs a quote for that; here the cell type does it). The price is a number and
 * the two dates are real dates (UTC: Excel keeps no time zone).
 */
const COLUMNS: Column<BookDto>[] = [
  { header: header(0), width: 38, cell: (book) => ({ value: book.id }) },
  { header: header(1), width: 40, cell: (book) => ({ value: book.title }) },
  { header: header(2), width: 28, cell: (book) => ({ value: book.author }) },
  { header: header(3), width: 24, cell: (book) => ({ value: book.publisher }) },
  { header: header(4), width: 20, cell: (book) => ({ value: book.genre }) },
  {
    header: header(5),
    width: 14,
    cell: (book) => ({
      value: book.price,
      type: Number,
      format: MONEY_FORMAT,
    }),
  },
  {
    header: header(6),
    width: 12,
    cell: (book) => ({ value: book.availability ? 'Sí' : 'No' }),
  },
  {
    header: header(7),
    width: 20,
    cell: (book) => ({
      value: book.createdAt,
      type: Date,
      format: DATE_FORMAT,
    }),
  },
  {
    header: header(8),
    width: 20,
    cell: (book) => ({
      value: book.updatedAt,
      type: Date,
      format: DATE_FORMAT,
    }),
  },
];

/**
 * The books as an `.xlsx` file: one sheet, bold header row that stays in view.
 * The rows are built here and not by the library's "objects" mode, which writes
 * nothing at all (not even the header) when the list is empty (E2.5).
 */
export function buildBooksXlsx(books: readonly BookDto[]): Promise<Buffer> {
  const rows: SheetData = [
    COLUMNS.map((column) => column.header),
    ...books.map((book, index) =>
      COLUMNS.map((column) => column.cell(book, index)),
    ),
  ];

  return writeXlsxFile(rows, {
    columns: COLUMNS.map(({ width }) => ({ width })),
    sheet: SHEET_NAME,
    stickyRowsCount: 1,
  }).toBuffer();
}
