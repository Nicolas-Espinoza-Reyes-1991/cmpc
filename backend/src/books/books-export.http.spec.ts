import { Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { parseString } from 'fast-csv';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { configureApp } from '../app.setup';
import { AuthModule } from '../auth/auth.module';
import { validateEnv } from '../config/env.validation';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { BooksModule } from './books.module';
import { EXPORT_BATCH_SIZE } from './books.service';

const SECRET = 'export-http-test-secret-with-at-least-32-chars';
const USER = {
  id: '3017f450-2092-454d-9a62-14ad55557302',
  email: 'admin@cmpc.local',
};
const createdAt = new Date('2026-10-28T10:00:00.000Z');
const updatedAt = new Date('2026-10-29T11:30:00.000Z');

const row = (n: number, overrides: Record<string, unknown> = {}) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  title: `Libro ${n}`,
  price: new Prisma.Decimal('9990.5'),
  availability: n % 2 === 0,
  imageUrl: '/api/uploads/secret-cover.png',
  authorId: 'a',
  publisherId: 'p',
  genreId: 'g',
  createdAt,
  updatedAt,
  deletedAt: null,
  author: { id: 'a', name: 'Gabriel García Márquez', createdAt },
  publisher: { id: 'p', name: 'Sudamericana', createdAt },
  genre: { id: 'g', name: 'Novela', createdAt },
  ...overrides,
});

const BOM = '﻿';

/** The CSV the client received, read back with a real parser. */
const readCsv = (text: string): Promise<string[][]> =>
  new Promise((resolve, reject) => {
    const rows: string[][] = [];
    parseString<string[], string[]>(text.replace(BOM, ''), { headers: false })
      .on('error', reject)
      .on('data', (parsed: string[]) => rows.push(parsed))
      .on('end', () => resolve(rows));
  });

/** The real guard, validation, filter and Express response; only the database is faked. */
describe('GET /api/books/export over HTTP', () => {
  const findMany = jest.fn<Promise<unknown>, [Record<string, unknown>]>();
  const findUnique = jest.fn();
  let app: NestExpressApplication;
  let auth: string;
  let warn: jest.SpyInstance;

  const exportCsv = (query = '') =>
    request(app.getHttpServer())
      .get(`/api/books/export${query}`)
      .set('Authorization', auth)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });
  const body = (res: { body: unknown }) =>
    (res.body as Buffer).toString('utf8');

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          ignoreEnvVars: true,
          load: [
            () =>
              validateEnv({
                DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
                JWT_SECRET: SECRET,
                UPLOAD_DIR: join(tmpdir(), 'cmpc-export-http-uploads'),
              }),
          ],
        }),
        PrismaModule,
        AuthModule,
        BooksModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({
        user: {
          findUnique: ({ where }: { where: { id?: string } }) =>
            Promise.resolve(where.id === USER.id ? { ...USER } : null),
        },
        live: { book: { findMany, findUnique } },
      })
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      logger: false,
    });
    configureApp(app);
    await app.init();
    auth = `Bearer ${await app.get(JwtService).signAsync({ sub: USER.id })}`;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    findMany.mockReset().mockResolvedValue([row(1), row(2)]);
    findUnique.mockReset();
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('answers 401 without a token and reads nothing', async () => {
    await request(app.getHttpServer()).get('/api/books/export').expect(401);

    expect(findMany).not.toHaveBeenCalled();
  });

  describe('the answer', () => {
    it('is a CSV attachment named after the day, never cached', async () => {
      const res = await exportCsv().expect(200);

      const today = new Date().toISOString().slice(0, 10);
      expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(res.headers['content-disposition']).toBe(
        `attachment; filename="libros-${today}.csv"`,
      );
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('is not wrapped in { data }: it is the file itself', async () => {
      const text = body(await exportCsv().expect(200));

      expect(text.startsWith(BOM + 'ID,')).toBe(true);
      expect(text).not.toContain('"data"');
    });

    it('starts with the UTF-8 byte order mark', async () => {
      const res = await exportCsv().expect(200);

      expect((res.body as Buffer).subarray(0, 3).toString('hex')).toBe(
        'efbbbf',
      );
    });

    it('is reachable at /export and not taken for a book id', async () => {
      await exportCsv().expect(200);

      expect(findUnique).not.toHaveBeenCalled();
    });
  });

  describe('the content', () => {
    it('has the header row in Spanish and one row per book', async () => {
      const rows = await readCsv(body(await exportCsv().expect(200)));

      expect(rows[0]).toEqual([
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
      expect(rows).toHaveLength(3);
      expect(rows[1]).toEqual([
        '00000000-0000-4000-8000-000000000001',
        'Libro 1',
        'Gabriel García Márquez',
        'Sudamericana',
        'Novela',
        '9990.5',
        'No',
        '2026-10-28T10:00:00.000Z',
        '2026-10-29T11:30:00.000Z',
      ]);
      expect(rows[2]?.[6]).toBe('Sí');
    });

    it('uses CRLF between rows and ends with one', async () => {
      const text = body(await exportCsv().expect(200));

      expect(text.endsWith('\r\n')).toBe(true);
      expect(text.split('\r\n')).toHaveLength(4);
    });

    it('keeps accents and the letter ñ', async () => {
      findMany.mockResolvedValue([
        row(1, { title: 'El año de la serpiente: niñez y ñandú' }),
      ]);

      const rows = await readCsv(body(await exportCsv().expect(200)));

      expect(rows[1]?.[1]).toBe('El año de la serpiente: niñez y ñandú');
    });

    it('quotes commas, quotes and line breaks so each book stays in one row', async () => {
      findMany.mockResolvedValue([
        row(1, { title: 'Uno, "dos"\ny tres' }),
        row(2),
      ]);

      const text = body(await exportCsv().expect(200));
      const rows = await readCsv(text);

      expect(text).toContain('"Uno, ""dos""\ny tres"');
      expect(rows).toHaveLength(3);
      expect(rows[1]?.[1]).toBe('Uno, "dos"\ny tres');
      expect(rows[2]?.[1]).toBe('Libro 2');
    });

    it.each([
      ['=HYPERLINK("http://evil.test","click")'],
      ["+cmd|' /C calc'!A0"],
      ['-2+3'],
      ['@SUM(1+1)'],
      ['\t=1+1'],
    ])('neutralizes the formula %j in the file', async (formula) => {
      findMany.mockResolvedValue([row(1, { title: formula })]);

      const rows = await readCsv(body(await exportCsv().expect(200)));

      expect(rows[1]?.[1]).toBe(`'${formula}`);
    });

    it('does not leak the cover URL or internal fields', async () => {
      const text = body(await exportCsv().expect(200));

      expect(text).not.toContain('secret-cover');
      expect(text).not.toContain('uploads');
      expect(text).not.toContain('deletedAt');
      expect(text).not.toContain('authorId');
    });

    it('is just the header row when no book matches', async () => {
      findMany.mockResolvedValue([]);

      const res = await exportCsv().expect(200);
      const rows = await readCsv(body(res));

      expect(rows).toHaveLength(1);
      expect(rows[0]?.[0]).toBe('ID');
    });
  });

  describe('what it exports', () => {
    it('applies the filters and the order of the listing', async () => {
      await exportCsv(
        '?search=%20dune%20&author=herb&availability=true&sort=genre:asc,price:desc',
      ).expect(200);

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { title: { contains: 'dune', mode: 'insensitive' } },
              { author: { name: { contains: 'herb', mode: 'insensitive' } } },
              { availability: true },
            ],
          },
          orderBy: [
            { genre: { name: 'asc' } },
            { price: 'desc' },
            { id: 'asc' },
          ],
        }),
      );
    });

    it('exports every batch, not a page', async () => {
      const full = Array.from({ length: EXPORT_BATCH_SIZE }, (_, i) =>
        row(i + 1),
      );
      findMany
        .mockResolvedValueOnce(full)
        .mockResolvedValueOnce([
          row(EXPORT_BATCH_SIZE + 1),
          row(EXPORT_BATCH_SIZE + 2),
        ]);

      const rows = await readCsv(body(await exportCsv().expect(200)));

      expect(rows).toHaveLength(1 + EXPORT_BATCH_SIZE + 2);
      expect(findMany).toHaveBeenCalledTimes(2);
      expect(findMany.mock.calls[1]?.[0]).toMatchObject({
        cursor: { id: full.at(-1)?.id },
        skip: 1,
      });
    });

    it.each([
      ['page=1', 'page'],
      ['limit=10', 'limit'],
      ['availability=maybe', 'availability'],
      ['sort=foo:asc', 'sort'],
      ['sort=title:asc,title:desc', 'sort'],
      ['search=' + 'a'.repeat(101), 'search'],
      ['unknown=1', 'unknown'],
    ])(
      'answers 400 for %s, naming the field, without reading',
      async (query, field) => {
        const res = await request(app.getHttpServer())
          .get(`/api/books/export?${query}`)
          .set('Authorization', auth)
          .expect(400);

        expect(
          (res.body as { errors: { field: string }[] }).errors.map(
            (e) => e.field,
          ),
        ).toContain(field);
        expect(findMany).not.toHaveBeenCalled();
      },
    );
  });

  describe('when something goes wrong', () => {
    it('answers a normal 500 without details if the database fails before the first byte', async () => {
      findMany.mockRejectedValue(new Error('connection refused to 10.0.0.5'));

      const res = await request(app.getHttpServer())
        .get('/api/books/export')
        .set('Authorization', auth)
        .expect(500);

      expect(res.body).toMatchObject({ statusCode: 500 });
      expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
      expect(res.headers['content-disposition']).toBeUndefined();
    });

    it('aborts the transfer and logs it if the database fails halfway', async () => {
      const full = Array.from({ length: EXPORT_BATCH_SIZE }, (_, i) =>
        row(i + 1),
      );
      findMany
        .mockResolvedValueOnce(full)
        .mockRejectedValueOnce(new Error('db down at 10.0.0.5'));

      await expect(exportCsv()).rejects.toThrow();

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('CSV export aborted'),
      );
    });

    it('stops reading the database when the client closes the connection', async () => {
      const full = Array.from({ length: EXPORT_BATCH_SIZE }, (_, i) =>
        row(i + 1),
      );
      findMany.mockImplementation(() => Promise.resolve(full));
      const server = app.getHttpServer();
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const { port } = server.address() as AddressInfo;

      await new Promise<void>((resolve) => {
        const req = http.get(
          { port, path: '/api/books/export', headers: { Authorization: auth } },
          (res) => {
            res.once('data', () => {
              // Close after the first chunk: the client has had enough.
              req.destroy();
              resolve();
            });
          },
        );
        req.on('error', () => undefined);
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
      const callsAfterClose = findMany.mock.calls.length;
      await new Promise((resolve) => setTimeout(resolve, 200));

      // The generator was closed: no more batches are read after the client left.
      expect(findMany.mock.calls.length).toBe(callsAfterClose);
      expect(callsAfterClose).toBeLessThan(50);
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });
  });
});
