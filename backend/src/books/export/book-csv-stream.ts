import { format } from 'fast-csv';
import { Readable, Transform } from 'node:stream';
import type { BookDto } from '../dto/book.dto';
import { CSV_BOM, CSV_HEADERS, toCsvRow } from './book-csv';

/**
 * The rows of the file, one at a time, taken from batches of books. The first
 * batch has already been read by the caller (so a failure of the database
 * before the first byte is a normal error response); the rest are read only as
 * the consumer asks. If the consumer stops, the `for await` closes the batches
 * and with them the reading of the database.
 */
async function* rowsOf(
  first: IteratorResult<BookDto[], void>,
  rest: AsyncGenerator<BookDto[], void, undefined>,
): AsyncGenerator<string[], void, undefined> {
  if (!first.done) {
    for (const book of first.value) yield toCsvRow(book);
  }
  for await (const batch of rest) {
    for (const book of batch) yield toCsvRow(book);
  }
}

/** The rows of the export as a stream of arrays of cells. */
export const bookCsvRows = (
  first: IteratorResult<BookDto[], void>,
  rest: AsyncGenerator<BookDto[], void, undefined>,
): Readable => Readable.from(rowsOf(first, rest));

/**
 * Turns rows into CSV text. It is a separate stage on purpose: the caller puts
 * rows, this and the response in ONE `pipeline`, so that when the client leaves
 * every stage is destroyed, including the rows and, through them, the reading
 * of the database. (`a.pipe(b)` would not close `a` when `b` is destroyed.)
 */
export const createCsvFormatter = (): Transform =>
  format({
    headers: [...CSV_HEADERS],
    writeHeaders: true,
    // Without rows `fast-csv` writes nothing at all, not even the header row.
    alwaysWriteHeaders: true,
    // RFC 4180: CRLF between rows, and also after the last one.
    rowDelimiter: '\r\n',
    includeEndRowDelimiter: true,
  });

/**
 * Puts the UTF-8 byte order mark in front of the first chunk. `fast-csv` has a
 * `writeBOM` option, but it writes the mark together with the first row: an
 * export with no books would have no mark and the accents of its header row
 * ("Título", "Género") would be garbled in Excel.
 */
export function createBomWriter(): Transform {
  let written = false;
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      if (!written) {
        written = true;
        this.push(CSV_BOM);
      }
      callback(null, chunk);
    },
  });
}
