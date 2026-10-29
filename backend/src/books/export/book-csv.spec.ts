import type { BookDto } from '../dto/book.dto';
import {
  CSV_BOM,
  CSV_HEADERS,
  csvFileName,
  escapeCsvCell,
  toCsvRow,
} from './book-csv';

const book = (overrides: Partial<BookDto> = {}): BookDto => ({
  id: '3f6c2a52-7f0e-4c3e-9d57-1d8f0f6a9b11',
  title: 'Cien años de soledad',
  author: 'Gabriel García Márquez',
  publisher: 'Editorial Sudamericana',
  genre: 'Novela',
  price: 12990,
  availability: true,
  imageUrl: '/api/uploads/x.png',
  createdAt: new Date('2026-10-28T10:00:00.000Z'),
  updatedAt: new Date('2026-10-29T11:30:00.000Z'),
  ...overrides,
});

describe('CSV_HEADERS', () => {
  it('names the nine columns in Spanish', () => {
    expect([...CSV_HEADERS]).toEqual([
      'ID',
      'Título',
      'Autor',
      'Editorial',
      'Género',
      'Precio',
      'Disponible',
      'Registrado',
      'Actualizado',
    ]);
  });

  it('is the UTF-8 byte order mark that Excel needs for accents', () => {
    expect(CSV_BOM).toBe('﻿');
    expect(Buffer.from(CSV_BOM).toString('hex')).toBe('efbbbf');
  });
});

describe('escapeCsvCell', () => {
  it.each(['=', '+', '-', '@', '\t', '\r'])(
    'puts a quote in front of a cell that starts with %j',
    (character) => {
      expect(escapeCsvCell(`${character}1+1`)).toBe(`'${character}1+1`);
    },
  );

  it.each([
    '=HYPERLINK("http://evil.test","click")',
    "+cmd|' /C calc'!A0",
    '-2+3',
    '@SUM(1+1)',
    '=1+1',
  ])('neutralizes the formula %j', (formula) => {
    const cell = escapeCsvCell(formula);

    expect(cell.startsWith("'")).toBe(true);
    expect(cell).toBe(`'${formula}`);
  });

  it.each([
    'Dune',
    'Cien años de soledad',
    '',
    ' ',
    'a=b',
    'x+y',
    'ni-ña',
    'correo@sitio.cl',
    "'ya tiene comilla",
    '100% real',
    '"quoted"',
  ])('leaves %j as it is', (text) => {
    expect(escapeCsvCell(text)).toBe(text);
  });

  it('only looks at the first character', () => {
    expect(escapeCsvCell('hola = mundo')).toBe('hola = mundo');
    expect(escapeCsvCell('ab\t=')).toBe('ab\t=');
  });
});

describe('toCsvRow', () => {
  it('lists the nine cells in the order of the headers', () => {
    expect(toCsvRow(book())).toEqual([
      '3f6c2a52-7f0e-4c3e-9d57-1d8f0f6a9b11',
      'Cien años de soledad',
      'Gabriel García Márquez',
      'Editorial Sudamericana',
      'Novela',
      '12990',
      'Sí',
      '2026-10-28T10:00:00.000Z',
      '2026-10-29T11:30:00.000Z',
    ]);
    expect(toCsvRow(book())).toHaveLength(CSV_HEADERS.length);
  });

  it.each([
    [12990, '12990'],
    [9990.5, '9990.5'],
    [0.01, '0.01'],
    [99_999_999.99, '99999999.99'],
    [100, '100'],
  ])('writes the price %s as a plain number: %s', (price, text) => {
    expect(toCsvRow(book({ price }))[5]).toBe(text);
  });

  it.each([
    [true, 'Sí'],
    [false, 'No'],
  ])('writes availability %s as %s', (availability, text) => {
    expect(toCsvRow(book({ availability }))[6]).toBe(text);
  });

  it('escapes the text columns that could be formulas, and only those', () => {
    const row = toCsvRow(
      book({
        title: '=HYPERLINK("http://evil.test")',
        author: '+34 600 000',
        publisher: '-Ed',
        genre: '@genero',
      }),
    );

    expect(row.slice(1, 5)).toEqual([
      '\'=HYPERLINK("http://evil.test")',
      "'+34 600 000",
      "'-Ed",
      "'@genero",
    ]);
    // The id, the price and the dates are the program's own: never escaped.
    expect(row[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(row[5]).toBe('12990');
    expect(row[7]).toMatch(/^2026-/);
  });

  it('does not export the cover URL or any internal field', () => {
    const row = toCsvRow(book({ imageUrl: '/api/uploads/secret.png' }));

    expect(row.join('|')).not.toContain('secret.png');
    expect(row.join('|')).not.toContain('uploads');
  });

  it('keeps commas, quotes and line breaks for the CSV writer to quote', () => {
    const row = toCsvRow(book({ title: 'Uno, "dos"\ntres' }));

    expect(row[1]).toBe('Uno, "dos"\ntres');
  });
});

describe('csvFileName', () => {
  it('names the file after the day, in UTC', () => {
    expect(csvFileName(new Date('2026-10-29T23:59:59.000Z'))).toBe(
      'libros-2026-10-29.csv',
    );
    expect(csvFileName(new Date('2026-01-05T00:00:00.000Z'))).toBe(
      'libros-2026-01-05.csv',
    );
  });
});
