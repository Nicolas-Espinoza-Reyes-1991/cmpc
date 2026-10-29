import { parseString } from 'fast-csv';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { BookDto } from '../dto/book.dto';
import {
  bookCsvRows,
  createBomWriter,
  createCsvFormatter,
} from './book-csv-stream';

const book = (n: number, overrides: Partial<BookDto> = {}): BookDto => ({
  id: `id-${n}`,
  title: `Libro ${n}`,
  author: 'Autor',
  publisher: 'Editorial',
  genre: 'Novela',
  price: 1000 + n,
  availability: true,
  imageUrl: null,
  createdAt: new Date('2026-10-28T10:00:00.000Z'),
  updatedAt: new Date('2026-10-28T10:00:00.000Z'),
  ...overrides,
});

const done: IteratorResult<BookDto[], void> = { done: true, value: undefined };
const first = (books: BookDto[]): IteratorResult<BookDto[], void> => ({
  done: false,
  value: books,
});

async function* batchesOf(
  ...batches: BookDto[][]
): AsyncGenerator<BookDto[], void, undefined> {
  for (const batch of batches) {
    await Promise.resolve();
    yield batch;
  }
}

/** A writable that keeps everything it receives as text. */
function collector() {
  const chunks: Buffer[] = [];
  const sink = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      chunks.push(chunk);
      callback();
    },
  });
  return { sink, text: () => Buffer.concat(chunks).toString('utf8') };
}

const parse = (text: string): Promise<string[][]> =>
  new Promise((resolve, reject) => {
    const rows: string[][] = [];
    parseString<string[], string[]>(text.replace('﻿', ''))
      .on('error', reject)
      .on('data', (row: string[]) => rows.push(row))
      .on('end', () => resolve(rows));
  });

describe('the CSV stream', () => {
  it('writes the header row and the rows of the first batch and of the rest', async () => {
    const { sink, text } = collector();

    await pipeline(
      bookCsvRows(first([book(1), book(2)]), batchesOf([book(3)], [book(4)])),
      createCsvFormatter(),
      createBomWriter(),
      sink,
    );

    const rows = await parse(text());
    expect(rows.map((row) => row[0])).toEqual([
      'ID',
      'id-1',
      'id-2',
      'id-3',
      'id-4',
    ]);
  });

  it('starts with the byte order mark and uses CRLF', async () => {
    const { sink, text } = collector();

    await pipeline(
      bookCsvRows(first([book(1)]), batchesOf()),
      createCsvFormatter(),
      createBomWriter(),
      sink,
    );

    expect(text().startsWith('﻿ID,')).toBe(true);
    expect(text().endsWith('\r\n')).toBe(true);
    expect(text().split('\r\n')).toHaveLength(3);
  });

  it('writes only the header row when there is no book at all', async () => {
    const { sink, text } = collector();

    await pipeline(
      bookCsvRows(done, batchesOf()),
      createCsvFormatter(),
      createBomWriter(),
      sink,
    );

    expect(text()).toBe(
      '﻿ID,Título,Autor,Editorial,Género,Precio,Disponible,Registrado,Actualizado\r\n',
    );
  });

  it('reads the later batches even if the first one was empty', async () => {
    const { sink, text } = collector();

    await pipeline(
      bookCsvRows(first([]), batchesOf([book(7)])),
      createCsvFormatter(),
      createBomWriter(),
      sink,
    );

    expect((await parse(text())).map((row) => row[0])).toEqual(['ID', 'id-7']);
  });

  it('escapes what a spreadsheet could run as a formula', async () => {
    const { sink, text } = collector();

    await pipeline(
      bookCsvRows(first([book(1, { title: '=1+1' })]), batchesOf()),
      createCsvFormatter(),
      createBomWriter(),
      sink,
    );

    expect((await parse(text()))[1]?.[1]).toBe("'=1+1");
  });

  describe('when the client goes away', () => {
    it('closes the batches, so the reading of the database stops', async () => {
      let closed = false;
      async function* rest(): AsyncGenerator<BookDto[], void, undefined> {
        try {
          for (let i = 0; i < 1000; i += 1) {
            await Promise.resolve();
            yield [book(i)];
          }
        } finally {
          closed = true;
        }
      }
      let received = 0;
      const leaving = new Writable({
        write(_chunk, _encoding, callback) {
          received += 1;
          // The client has had enough after the first chunk.
          if (received === 1) this.destroy();
          callback();
        },
      });

      await expect(
        pipeline(
          bookCsvRows(first([book(0)]), rest()),
          createCsvFormatter(),
          leaving,
        ),
      ).rejects.toThrow();

      // The generator's `finally` runs: its source stopped being read.
      await new Promise((resolve) => setImmediate(resolve));
      expect(closed).toBe(true);
    });

    it('does not read ahead of a slow client (backpressure)', async () => {
      let pulled = 0;
      async function* rest(): AsyncGenerator<BookDto[], void, undefined> {
        for (let i = 0; i < 2000; i += 1) {
          pulled += 1;
          await Promise.resolve();
          yield [book(i)];
        }
      }
      let received = 0;
      const slow = new Writable({
        highWaterMark: 64,
        write(_chunk, _encoding, callback) {
          received += 1;
          setTimeout(callback, 2);
        },
      });
      const transfer = pipeline(
        bookCsvRows(first([book(0)]), rest()),
        createCsvFormatter(),
        createBomWriter(),
        slow,
      );

      await new Promise((resolve) => setTimeout(resolve, 60));
      const pulledWhileSlow = pulled;
      slow.destroy();
      await expect(transfer).rejects.toThrow();

      // The client took few chunks, and the source was asked for far fewer batches
      // than it has: what was read ahead is bounded by the buffers of the stages
      // (about 16 KB each), not by the size of the export.
      expect(received).toBeLessThan(200);
      expect(pulledWhileSlow).toBeLessThan(1000);
    });
  });

  it('control: a fast client drains every batch (so the slow client test can tell)', async () => {
    let pulled = 0;
    async function* rest(): AsyncGenerator<BookDto[], void, undefined> {
      for (let i = 0; i < 2000; i += 1) {
        pulled += 1;
        await Promise.resolve();
        yield [book(i)];
      }
    }
    const { sink } = collector();

    await pipeline(
      bookCsvRows(first([book(0)]), rest()),
      createCsvFormatter(),
      createBomWriter(),
      sink,
    );

    expect(pulled).toBe(2000);
  });

  it('lets a failure of the database in a later batch abort the transfer', async () => {
    async function* rest(): AsyncGenerator<BookDto[], void, undefined> {
      await Promise.resolve();
      yield [book(1)];
      throw new Error('db down');
    }
    const { sink } = collector();

    await expect(
      pipeline(
        bookCsvRows(first([book(0)]), rest()),
        createCsvFormatter(),
        sink,
      ),
    ).rejects.toThrow('db down');
  });
});
