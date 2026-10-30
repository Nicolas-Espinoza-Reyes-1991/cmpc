import { Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { configureApp } from '../app.setup';
import { AuthModule } from '../auth/auth.module';
import { validateEnv } from '../config/env.validation';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { BooksModule } from './books.module';
import { CSV_HEADERS } from './export/book-csv';
import { XLSX_CONTENT_TYPE, XLSX_MAX_ROWS } from './export/book-xlsx';
import { readXlsx } from './export/xlsx-reader.helper-spec';

const SECRET = 'xlsx-http-test-secret-with-at-least-32-chars';
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

/** The strings of the workbook, by the index the cells use. */
const strings = (parts: Record<string, string>): string[] =>
  [
    ...(parts['xl/sharedStrings.xml'] ?? '').matchAll(
      /<si><t[^>]*>(.*?)<\/t><\/si>/gs,
    ),
  ].map((match) =>
    (match[1] ?? '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&'),
  );

/** The value of a cell of the first sheet: text for text cells, the raw number otherwise. */
function cell(parts: Record<string, string>, reference: string): string {
  const match = new RegExp(`<c r="${reference}"([^>]*)><v>(.*?)</v></c>`).exec(
    parts['xl/worksheets/sheet1.xml'] ?? '',
  );
  if (!match) throw new Error(`No cell ${reference}`);
  const raw = match[2] ?? '';
  return /t="s"/.test(match[1] ?? '')
    ? (strings(parts)[Number(raw)] ?? '')
    : raw;
}

/** The real guard, validation, filter and Express response; only the database is faked. */
describe('GET /api/books/export/xlsx over HTTP', () => {
  const findMany = jest.fn<Promise<unknown>, [Record<string, unknown>]>();
  const count = jest.fn();
  const findUnique = jest.fn();
  let app: NestExpressApplication;
  let auth: string;

  const exportXlsx = (query = '') =>
    request(app.getHttpServer())
      .get(`/api/books/export/xlsx${query}`)
      .set('Authorization', auth)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });
  const workbook = (res: { body: unknown }) => readXlsx(res.body as Buffer);

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
                UPLOAD_DIR: join(tmpdir(), 'cmpc-export-xlsx-http-uploads'),
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
        live: { book: { findMany, findUnique, count } },
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
    count.mockReset().mockResolvedValue(2);
    findUnique.mockReset();
  });

  it('answers 401 without a token and reads nothing', async () => {
    await request(app.getHttpServer())
      .get('/api/books/export/xlsx')
      .expect(401);

    expect(count).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  describe('the answer', () => {
    it('is an Excel attachment named after the day, never cached, with its exact size', async () => {
      const res = await exportXlsx().expect(200);

      expect(res.headers['content-type']).toBe(XLSX_CONTENT_TYPE);
      expect(res.headers['content-disposition']).toMatch(
        /^attachment; filename="libros-\d{4}-\d{2}-\d{2}\.xlsx"$/,
      );
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['content-length']).toBe(
        String((res.body as Buffer).length),
      );
    });

    it('is a real workbook: a zip with one sheet called "Libros"', async () => {
      const res = await exportXlsx().expect(200);
      const parts = workbook(res);

      expect((res.body as Buffer).subarray(0, 2).toString()).toBe('PK');
      expect(parts['xl/workbook.xml']).toContain('name="Libros"');
    });

    it('is not wrapped in { data }, it is the file itself', async () => {
      const res = await exportXlsx().expect(200);

      expect(Buffer.isBuffer(res.body)).toBe(true);
    });
  });

  describe('the content', () => {
    it('has one column per field, with the headers of the CSV', async () => {
      const parts = workbook(await exportXlsx().expect(200));

      expect('ABCDEFGHI'.split('').map((c) => cell(parts, `${c}1`))).toEqual([
        ...CSV_HEADERS,
      ]);
    });

    it('has one row per book with the texts, the price as a number and real dates', async () => {
      const parts = workbook(await exportXlsx().expect(200));

      expect('ABCDE'.split('').map((c) => cell(parts, `${c}2`))).toEqual([
        '00000000-0000-4000-8000-000000000001',
        'Libro 1',
        'Gabriel García Márquez',
        'Sudamericana',
        'Novela',
      ]);
      expect(cell(parts, 'F2')).toBe('9990.5');
      expect(cell(parts, 'G2')).toBe('No');
      expect(cell(parts, 'G3')).toBe('Sí');
      expect(Number(cell(parts, 'H2'))).toBeCloseTo(
        createdAt.getTime() / 86_400_000 + 25_569,
        6,
      );
      expect(Number(cell(parts, 'I2'))).toBeCloseTo(
        updatedAt.getTime() / 86_400_000 + 25_569,
        6,
      );
    });

    it('does not export the cover URL', async () => {
      const parts = workbook(await exportXlsx().expect(200));

      expect(strings(parts).join('|')).not.toContain('secret-cover');
    });

    it('keeps a title that looks like a formula as text, without a quote in front', async () => {
      const title = '=HYPERLINK("http://evil.test","click")';
      findMany.mockResolvedValue([row(1, { title })]);
      count.mockResolvedValue(1);

      const parts = workbook(await exportXlsx().expect(200));

      expect(cell(parts, 'B2')).toBe(title);
      expect(parts['xl/worksheets/sheet1.xml']).not.toContain('<f>');
    });

    it('has only the header row when no book matches', async () => {
      findMany.mockResolvedValue([]);
      count.mockResolvedValue(0);

      const res = await exportXlsx().expect(200);
      const parts = workbook(res);

      expect(cell(parts, 'A1')).toBe('ID');
      expect(parts['xl/worksheets/sheet1.xml']).not.toContain('<row r="2"');
    });
  });

  describe('what it exports', () => {
    it('uses the filters and the order of the listing, counting and reading with the same ones', async () => {
      await exportXlsx(
        '?search=%20dune%20&author=herb&availability=true&sort=genre:asc,price:desc',
      ).expect(200);

      const expectedWhere = {
        AND: [
          { title: { contains: 'dune', mode: 'insensitive' } },
          { author: { name: { contains: 'herb', mode: 'insensitive' } } },
          { availability: true },
        ],
      };
      expect(count).toHaveBeenCalledWith({ where: expectedWhere });
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expectedWhere,
          orderBy: [
            { genre: { name: 'asc' } },
            { price: 'desc' },
            { id: 'asc' },
          ],
        }),
      );
    });

    it('is not taken as the id of a book: the route is declared before :id', async () => {
      await exportXlsx().expect(200);

      expect(findUnique).not.toHaveBeenCalled();
    });
  });

  describe('when something goes wrong', () => {
    it.each([
      ['page', '?page=1'],
      ['limit', '?limit=10'],
      ['an unknown parameter', '?hack=1'],
      ['an invalid sort', '?sort=password:asc'],
    ])('rejects %s with 400 and reads nothing', async (_name, query) => {
      await request(app.getHttpServer())
        .get(`/api/books/export/xlsx${query}`)
        .set('Authorization', auth)
        .expect(400);

      expect(count).not.toHaveBeenCalled();
      expect(findMany).not.toHaveBeenCalled();
    });

    it('answers 422 in the normal error format when more than 20,000 books match, reading none', async () => {
      count.mockResolvedValue(XLSX_MAX_ROWS + 1);

      const res = await request(app.getHttpServer())
        .get('/api/books/export/xlsx')
        .set('Authorization', auth)
        .expect(422);

      expect(res.body).toMatchObject({
        statusCode: 422,
        message: `Too many books for Excel (maximum ${XLSX_MAX_ROWS}): narrow the filters or use the CSV export`,
        path: '/api/books/export/xlsx',
      });
      expect(findMany).not.toHaveBeenCalled();
    });

    it('answers a generic 500 before any byte goes out when the database fails', async () => {
      const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      count.mockRejectedValue(new Error('connection refused to 10.0.0.5'));

      const res = await request(app.getHttpServer())
        .get('/api/books/export/xlsx')
        .set('Authorization', auth)
        .expect(500);

      expect(res.body).toMatchObject({ statusCode: 500 });
      expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
      error.mockRestore();
    });
  });
});
