import type { BookDto } from '../dto/book.dto';
import { CSV_HEADERS } from './book-csv';
import {
  XLSX_CONTENT_TYPE,
  XLSX_MAX_ROWS,
  buildBooksXlsx,
  xlsxFileName,
} from './book-xlsx';
import { readXlsx } from './xlsx-reader.helper-spec';

const created = new Date('2026-10-28T14:53:54.414Z');
const updated = new Date('2026-10-29T09:00:00.000Z');

const book = (overrides: Partial<BookDto> = {}): BookDto => ({
  id: '3f6c2a52-7f0e-4c3e-9d57-1d8f0f6a9b11',
  title: 'Cien años de soledad',
  author: 'Gabriel García Márquez',
  publisher: 'Editorial Sudamericana',
  genre: 'Novela',
  price: 9990.5,
  availability: true,
  imageUrl: '/api/uploads/never-exported.png',
  createdAt: created,
  updatedAt: updated,
  ...overrides,
});

const unescape = (xml: string): string =>
  xml
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

/** The text of every shared string, by the index the cells point to. */
const sharedStrings = (parts: Record<string, string>): string[] =>
  [
    ...(parts['xl/sharedStrings.xml'] ?? '').matchAll(
      /<si><t[^>]*>(.*?)<\/t><\/si>/gs,
    ),
  ].map((match) => unescape(match[1] ?? ''));

interface Cell {
  /** `s` for text, undefined for a number. */
  type: string | undefined;
  style: string | undefined;
  /** Text for text cells, the raw number for the rest. */
  value: string;
}

/** A cell of the first sheet by its reference (`B2`). */
function cell(parts: Record<string, string>, reference: string): Cell {
  const sheet = parts['xl/worksheets/sheet1.xml'] ?? '';
  const match = new RegExp(`<c r="${reference}"([^>]*)><v>(.*?)</v></c>`).exec(
    sheet,
  );
  if (!match) throw new Error(`No cell ${reference}`);
  const attributes = match[1] ?? '';
  const type = /t="(\w+)"/.exec(attributes)?.[1];
  const style = /s="(\d+)"/.exec(attributes)?.[1];
  const raw = match[2] ?? '';
  return {
    type,
    style,
    value: type === 's' ? (sharedStrings(parts)[Number(raw)] ?? '') : raw,
  };
}

/** Excel stores a date as the days since 1899-12-30. */
const excelSerial = (date: Date): number =>
  date.getTime() / 86_400_000 + 25_569;

const open = async (books: BookDto[]) => readXlsx(await buildBooksXlsx(books));

describe('buildBooksXlsx', () => {
  it('builds a real .xlsx with one sheet called "Libros"', async () => {
    const file = await buildBooksXlsx([book()]);
    const parts = readXlsx(file);

    expect(file.subarray(0, 2).toString()).toBe('PK');
    expect(Object.keys(parts)).toEqual(
      expect.arrayContaining([
        '[Content_Types].xml',
        'xl/workbook.xml',
        'xl/worksheets/sheet1.xml',
        'xl/styles.xml',
        'xl/sharedStrings.xml',
      ]),
    );
    expect(parts['xl/workbook.xml']).toContain('name="Libros"');
  });

  it('puts every field of the CSV in its own column, with the same headers', async () => {
    const parts = await open([book()]);
    const columns = 'ABCDEFGHI'.split('');

    expect(columns.map((c) => cell(parts, `${c}1`).value)).toEqual([
      ...CSV_HEADERS,
    ]);
  });

  it('writes the headers in bold and the data rows in the normal font', async () => {
    const parts = await open([book()]);
    const bold = cell(parts, 'A1').style;

    expect(
      'ABCDEFGHI'.split('').map((c) => cell(parts, `${c}1`).style),
    ).toEqual(Array(9).fill(bold));
    expect(parts['xl/styles.xml']).toContain('<b/>');
    // The title of the book (text, no number format) is not styled.
    expect(cell(parts, 'B2').style).toBeUndefined();
  });

  it('keeps the header row in view while scrolling', async () => {
    const parts = await open([book()]);

    expect(parts['xl/worksheets/sheet1.xml']).toMatch(
      /<pane ySplit="1"[^>]*state="frozen"/,
    );
  });

  it('gives each column a width that fits its content', async () => {
    const parts = await open([book()]);
    const widths = [
      ...(parts['xl/worksheets/sheet1.xml'] ?? '').matchAll(
        /<col [^>]*width="(\d+)"/g,
      ),
    ].map((match) => Number(match[1]));

    expect(widths).toEqual([38, 40, 28, 24, 20, 14, 12, 20, 20]);
  });

  it('writes the texts as text, in the order of the columns', async () => {
    const parts = await open([book()]);

    expect(['A', 'B', 'C', 'D', 'E'].map((c) => cell(parts, `${c}2`))).toEqual(
      [
        '3f6c2a52-7f0e-4c3e-9d57-1d8f0f6a9b11',
        'Cien años de soledad',
        'Gabriel García Márquez',
        'Editorial Sudamericana',
        'Novela',
      ].map((value) => ({ type: 's', style: undefined, value })),
    );
  });

  it('writes the price as a number with a thousands and two-decimals format', async () => {
    const parts = await open([book(), book({ price: 12000 })]);

    expect(cell(parts, 'F2')).toMatchObject({
      type: undefined,
      value: '9990.5',
    });
    expect(cell(parts, 'F3')).toMatchObject({
      type: undefined,
      value: '12000',
    });
    expect(cell(parts, 'F2').style).toBeDefined();
    expect(parts['xl/styles.xml']).toContain('formatCode="#,##0.00"');
  });

  it('writes the two dates as real dates (UTC) with a fixed format', async () => {
    const parts = await open([book()]);

    expect(Number(cell(parts, 'H2').value)).toBeCloseTo(
      excelSerial(created),
      6,
    );
    expect(Number(cell(parts, 'I2').value)).toBeCloseTo(
      excelSerial(updated),
      6,
    );
    expect(cell(parts, 'H2').type).toBeUndefined();
    expect(parts['xl/styles.xml']).toContain(
      'formatCode="yyyy-mm-dd hh:mm:ss"',
    );
  });

  it('says Sí or No for the availability', async () => {
    const parts = await open([book(), book({ availability: false })]);

    expect(cell(parts, 'G2').value).toBe('Sí');
    expect(cell(parts, 'G3').value).toBe('No');
  });

  it('keeps a title that looks like a formula as plain text, never as a formula', async () => {
    const title = '=HYPERLINK("http://evil.test","click")';
    const parts = await open([
      book({ title, author: '+cmd', publisher: '-x', genre: '@SUM(A1)' }),
    ]);
    const sheet = parts['xl/worksheets/sheet1.xml'] ?? '';

    expect(cell(parts, 'B2')).toMatchObject({ type: 's', value: title });
    expect([2, 3, 4].map((i) => cell(parts, `${'ABCDE'[i]}2`).value)).toEqual([
      '+cmd',
      '-x',
      '@SUM(A1)',
    ]);
    // No formula element anywhere, and nothing was prefixed with a quote.
    expect(sheet).not.toContain('<f>');
    expect(sharedStrings(parts).some((text) => text.startsWith("'"))).toBe(
      false,
    );
  });

  it('survives characters that XML treats specially, and accents', async () => {
    const title = 'Plaza & Janés <"ñandú"> \'x\'';
    const parts = await open([book({ title })]);

    expect(cell(parts, 'B2').value).toBe(title);
  });

  it('writes only the header row when there are no books', async () => {
    const parts = await open([]);

    expect(cell(parts, 'A1').value).toBe('ID');
    expect(parts['xl/worksheets/sheet1.xml']).not.toContain('<row r="2"');
  });

  it('writes one row per book, in the order given', async () => {
    const parts = await open([
      book({ id: 'first', title: 'Uno' }),
      book({ id: 'second', title: 'Dos' }),
      book({ id: 'third', title: 'Tres' }),
    ]);

    expect([2, 3, 4].map((row) => cell(parts, `B${row}`).value)).toEqual([
      'Uno',
      'Dos',
      'Tres',
    ]);
    expect(parts['xl/worksheets/sheet1.xml']).not.toContain('<row r="5"');
  });

  it('does not export the cover URL or anything that is not a column', async () => {
    const parts = await open([book()]);

    expect(sharedStrings(parts).join('|')).not.toContain('never-exported');
    expect(parts['xl/worksheets/sheet1.xml']).not.toContain('J1');
  });
});

describe('the Excel export constants', () => {
  it('limits a file to 20,000 books', () => {
    expect(XLSX_MAX_ROWS).toBe(20_000);
  });

  it('uses the content type of an .xlsx file', () => {
    expect(XLSX_CONTENT_TYPE).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  });

  it('names the file after the day in UTC', () => {
    expect(xlsxFileName(new Date('2026-10-29T23:59:59.000Z'))).toBe(
      'libros-2026-10-29.xlsx',
    );
    expect(xlsxFileName(new Date('2026-01-02T00:00:00.000Z'))).toBe(
      'libros-2026-01-02.xlsx',
    );
  });
});
