import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { configureApp } from '../app.setup';
import { AuthModule } from '../auth/auth.module';
import { validateEnv } from '../config/env.validation';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { BooksModule } from './books.module';

const SECRET = 'books-http-test-secret-with-at-least-32-chars';
const USER = {
  id: '3017f450-2092-454d-9a62-14ad55557302',
  email: 'admin@cmpc.local',
};
const ID = '3f6c2a52-7f0e-4c3e-9d57-1d8f0f6a9b11';
const createdAt = new Date('2026-10-28T10:00:00.000Z');

const row = {
  id: ID,
  title: 'Dune',
  price: new Prisma.Decimal('9990.5'),
  availability: true,
  imageUrl: null,
  authorId: 'a',
  publisherId: 'p',
  genreId: 'g',
  createdAt,
  updatedAt: createdAt,
  deletedAt: null,
  author: { id: 'a', name: 'Frank Herbert', createdAt },
  publisher: { id: 'p', name: 'Ace', createdAt },
  genre: { id: 'g', name: 'Ciencia ficción', createdAt },
};

const valid = {
  title: 'Dune',
  author: 'Frank Herbert',
  publisher: 'Ace',
  genre: 'Ciencia ficción',
  price: 9990.5,
  availability: true,
};

/** The real Passport guard, validation pipe, filter and interceptor; only the database is faked. */
describe('books over HTTP (real Passport)', () => {
  const tx = {
    book: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([]),
    author: { findFirst: jest.fn(), upsert: jest.fn() },
    publisher: { findFirst: jest.fn(), upsert: jest.fn() },
    genre: { findFirst: jest.fn(), upsert: jest.fn() },
  };
  const findUnique = jest.fn();
  const count = jest.fn();
  const findMany = jest.fn();
  const $transaction = jest.fn();
  let app: NestExpressApplication;
  let auth: string;

  const api = () => request(app.getHttpServer());

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
                // The image storage creates this directory on start: keep it out of the repository.
                UPLOAD_DIR: join(tmpdir(), 'cmpc-books-http-uploads'),
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
        live: { $transaction, book: { findUnique, count, findMany } },
        // The catalog list/read client is not used by these routes.
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
    // A callback receives the transaction client; a list of queries is run together.
    $transaction
      .mockReset()
      .mockImplementation(
        (
          work: ((client: typeof tx) => Promise<unknown>) | Promise<unknown>[],
        ) => (Array.isArray(work) ? Promise.all(work) : work(tx)),
      );
    count.mockReset().mockResolvedValue(1);
    findMany.mockReset().mockResolvedValue([row]);
    findUnique.mockReset().mockResolvedValue(row);
    tx.book.create.mockReset().mockResolvedValue(row);
    tx.book.update.mockReset().mockResolvedValue(row);
    tx.book.findUnique.mockReset().mockResolvedValue(row);
    tx.auditLog.create.mockReset().mockResolvedValue({});
    for (const catalog of [tx.author, tx.publisher, tx.genre]) {
      catalog.findFirst.mockReset().mockResolvedValue(null);
      catalog.upsert.mockReset().mockResolvedValue({ id: 'new' });
    }
  });

  describe('without a token', () => {
    it.each([
      ['get', '/api/books'],
      ['post', '/api/books'],
      ['get', `/api/books/${ID}`],
      ['patch', `/api/books/${ID}`],
      ['delete', `/api/books/${ID}`],
    ] as const)('%s %s answers 401 and does nothing', async (method, url) => {
      const res = await api()[method](url).send(valid);

      expect(res.status).toBe(401);
      expect($transaction).not.toHaveBeenCalled();
      expect(findUnique).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/books (listing)', () => {
    const list = (query = '') =>
      api().get(`/api/books${query}`).set('Authorization', auth);

    it('answers 200 with the page in data and the totals in meta', async () => {
      count.mockResolvedValue(25);

      const res = await list('?page=2&limit=10').expect(200);

      expect(res.body).toMatchObject({
        data: [
          { id: ID, title: 'Dune', author: 'Frank Herbert', price: 9990.5 },
        ],
        meta: { page: 2, limit: 10, total: 25 },
      });
      expect(res.body).not.toHaveProperty('data.0.deletedAt');
    });

    it('uses page 1 with 10 books when no parameter is sent', async () => {
      const res = await list().expect(200);

      expect(res.body).toMatchObject({
        meta: { page: 1, limit: 10, total: 1 },
      });
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10 }),
      );
    });

    it('turns the query string into filters and order for the database', async () => {
      await list(
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

    it('answers 200 with an empty page beyond the last one', async () => {
      count.mockResolvedValue(3);
      findMany.mockResolvedValue([]);

      const res = await list('?page=50').expect(200);

      expect(res.body).toEqual({
        data: [],
        meta: { page: 50, limit: 10, total: 3 },
      });
    });

    it.each([
      ['limit=101', 'limit'],
      ['limit=0', 'limit'],
      ['page=0', 'page'],
      ['page=abc', 'page'],
      ['availability=maybe', 'availability'],
      ['sort=foo:asc', 'sort'],
      ['sort=title:asc,title:desc', 'sort'],
      ['sort=title:asc,author:asc,genre:asc,price:asc,publisher:asc', 'sort'],
      ['search=' + 'a'.repeat(101), 'search'],
      ['unknown=1', 'unknown'],
    ])(
      'answers 400 for %s, naming the field, without querying',
      async (query, field) => {
        const res = await list(`?${query}`).expect(400);

        expect(
          (res.body as { errors: { field: string }[] }).errors.map(
            (e) => e.field,
          ),
        ).toContain(field);
        expect($transaction).not.toHaveBeenCalled();
      },
    );

    it('is not shadowed by the :id route', async () => {
      await list().expect(200);

      expect(findUnique).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/books', () => {
    it('creates the book and answers 201 with { data }', async () => {
      const res = await api()
        .post('/api/books')
        .set('Authorization', auth)
        .send(valid)
        .expect(201);

      expect(res.body).toEqual({
        data: {
          id: ID,
          title: 'Dune',
          author: 'Frank Herbert',
          publisher: 'Ace',
          genre: 'Ciencia ficción',
          price: 9990.5,
          availability: true,
          imageUrl: null,
          createdAt: createdAt.toISOString(),
          updatedAt: createdAt.toISOString(),
        },
      });
    });

    it('normalizes the texts before they reach the service', async () => {
      await api()
        .post('/api/books')
        .set('Authorization', auth)
        .send({ ...valid, title: '  Dune   Messiah  ' })
        .expect(201);

      expect(tx.book.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: 'Dune Messiah' }) as unknown,
        }),
      );
    });

    it('answers 400 with one error per invalid field and saves nothing', async () => {
      const res = await api()
        .post('/api/books')
        .set('Authorization', auth)
        .send({ ...valid, title: '', price: -1, availability: 'yes' })
        .expect(400);

      expect(res.body).toMatchObject({ statusCode: 400, path: '/api/books' });
      expect(
        (res.body as { errors: { field: string }[] }).errors.map(
          (e) => e.field,
        ),
      ).toEqual(expect.arrayContaining(['title', 'price', 'availability']));
      expect($transaction).not.toHaveBeenCalled();
    });

    it.each(['id', 'imageUrl', 'deletedAt'])(
      'rejects the property %s (it is not part of the contract)',
      async (field) => {
        const res = await api()
          .post('/api/books')
          .set('Authorization', auth)
          .send({ ...valid, [field]: 'x' })
          .expect(400);

        expect(
          (res.body as { errors: { field: string }[] }).errors[0]?.field,
        ).toBe(field);
        expect($transaction).not.toHaveBeenCalled();
      },
    );

    it('answers 409 with the unified body for a duplicate book', async () => {
      tx.book.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { modelName: 'Book' },
        }),
      );

      const res = await api()
        .post('/api/books')
        .set('Authorization', auth)
        .send(valid)
        .expect(409);

      expect(res.body).toMatchObject({
        statusCode: 409,
        message:
          'A book with the same title, author and publisher already exists',
        path: '/api/books',
      });
    });

    it('answers 500 without internal details when the database fails', async () => {
      tx.book.create.mockRejectedValue(
        new Error('connection refused to 10.0.0.5'),
      );

      const res = await api()
        .post('/api/books')
        .set('Authorization', auth)
        .send(valid)
        .expect(500);

      expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
    });
  });

  describe('GET /api/books/:id', () => {
    it('returns the book', async () => {
      const res = await api()
        .get(`/api/books/${ID}`)
        .set('Authorization', auth)
        .expect(200);

      expect(res.body).toMatchObject({ data: { id: ID, title: 'Dune' } });
      expect(res.body).not.toHaveProperty('data.deletedAt');
    });

    it('answers 404 for a missing or deleted book', async () => {
      findUnique.mockResolvedValue(null);

      const res = await api()
        .get(`/api/books/${ID}`)
        .set('Authorization', auth)
        .expect(404);

      expect(res.body).toMatchObject({
        statusCode: 404,
        message: 'Book not found',
      });
    });

    it('answers 400 when the id is not a UUID, without querying', async () => {
      await api()
        .get('/api/books/not-a-uuid')
        .set('Authorization', auth)
        .expect(400);

      expect(findUnique).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/books/:id', () => {
    it('changes the given fields and answers 200', async () => {
      const res = await api()
        .patch(`/api/books/${ID}`)
        .set('Authorization', auth)
        .send({ price: 12000 })
        .expect(200);

      expect(res.body).toMatchObject({ data: { id: ID } });
      expect(tx.book.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ price: 12000 }) as unknown,
        }),
      );
    });

    it('answers 400 for an empty body', async () => {
      const res = await api()
        .patch(`/api/books/${ID}`)
        .set('Authorization', auth)
        .send({})
        .expect(400);

      expect(res.body).toMatchObject({
        message: 'At least one field is required',
      });
    });

    it.each(['id', 'imageUrl', 'deletedAt'])(
      'rejects the property %s (C4.5)',
      async (field) => {
        await api()
          .patch(`/api/books/${ID}`)
          .set('Authorization', auth)
          .send({ [field]: 'x' })
          .expect(400);

        expect($transaction).not.toHaveBeenCalled();
      },
    );

    it('answers 404 when the book is missing or deleted', async () => {
      tx.book.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('none', {
          code: 'P2025',
          clientVersion: 'test',
        }),
      );

      await api()
        .patch(`/api/books/${ID}`)
        .set('Authorization', auth)
        .send({ title: 'x' })
        .expect(404);
    });

    it('answers 400 when the id is not a UUID', async () => {
      await api()
        .patch('/api/books/42')
        .set('Authorization', auth)
        .send({ title: 'x' })
        .expect(400);
    });
  });

  describe('DELETE /api/books/:id', () => {
    it('answers 204 with no body and marks the book as deleted', async () => {
      const res = await api()
        .delete(`/api/books/${ID}`)
        .set('Authorization', auth)
        .expect(204);

      expect(res.text).toBe('');
      expect(tx.book.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { deletedAt: expect.any(Date) as unknown },
      });
    });

    it('answers 404 when the book is missing or already deleted', async () => {
      tx.book.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('none', {
          code: 'P2025',
          clientVersion: 'test',
        }),
      );

      await api()
        .delete(`/api/books/${ID}`)
        .set('Authorization', auth)
        .expect(404);
    });

    it('answers 400 when the id is not a UUID', async () => {
      await api().delete('/api/books/x').set('Authorization', auth).expect(400);

      expect($transaction).not.toHaveBeenCalled();
    });
  });
});
