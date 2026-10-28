import { Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { configureApp } from '../app.setup';
import { AuthModule } from '../auth/auth.module';
import { PasswordHasher } from '../auth/password-hasher';
import { BooksModule } from '../books/books.module';
import { validateEnv } from '../config/env.validation';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';

const SECRET = 'audit-http-test-secret-with-at-least-32-chars';
const PASSWORD = 'correct horse battery staple';
const USER = {
  id: '3017f450-2092-454d-9a62-14ad55557302',
  email: 'admin@cmpc.local',
};
const ID = '3f6c2a52-7f0e-4c3e-9d57-1d8f0f6a9b11';
const CLIENT_IP = '198.51.100.9';
const createdAt = new Date('2026-10-28T10:00:00.000Z');
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32),
]);

const bookRow = (overrides: Record<string, unknown> = {}) => ({
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
  ...overrides,
});

const valid = {
  title: 'Dune',
  author: 'Frank Herbert',
  publisher: 'Ace',
  genre: 'Ciencia ficción',
  price: 9990.5,
  availability: true,
};

interface WrittenEntry {
  action: string;
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  userId: string | null;
  ip: string | null;
}

/**
 * The real Passport guard, validation, books and auth modules and the real
 * AuditService; only the database is faked, and it records what is written to
 * the audit table. `trust proxy` = 1, so the ip comes from X-Forwarded-For.
 */
describe('the audit trail over HTTP', () => {
  const written: WrittenEntry[] = [];
  const auditCreate = jest.fn();
  const bookFindUnique = jest.fn();
  const tx = {
    book: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    auditLog: { create: auditCreate },
    author: { findFirst: jest.fn(), upsert: jest.fn() },
    publisher: { findFirst: jest.fn(), upsert: jest.fn() },
    genre: { findFirst: jest.fn(), upsert: jest.fn() },
  };
  const $transaction = jest.fn();
  const findUserByEmail = jest.fn<
    Promise<unknown>,
    [{ id?: string; email?: string }]
  >();
  let uploadDir: string;
  let passwordHash: string;
  let app: NestExpressApplication;
  let auth: string;

  const api = () => request(app.getHttpServer());
  const asUser = <T extends request.Test>(req: T) =>
    req.set('Authorization', auth).set('X-Forwarded-For', CLIENT_IP);

  beforeAll(async () => {
    passwordHash = await new PasswordHasher().hash(PASSWORD);
    uploadDir = await mkdtemp(join(tmpdir(), 'cmpc-audit-http-'));
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
                UPLOAD_DIR: uploadDir,
                THROTTLE_LIMIT: '1000',
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
          findUnique: ({ where }: { where: { id?: string; email?: string } }) =>
            findUserByEmail(where),
        },
        // Logins write through the service itself, books through the transaction.
        auditLog: { create: auditCreate },
        live: { $transaction, book: { findUnique: bookFindUnique } },
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
    await rm(uploadDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    written.length = 0;
    jest.restoreAllMocks();
    // The suite checks what is written, not what is logged.
    for (const level of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation(() => undefined);
    }
    auditCreate
      .mockReset()
      .mockImplementation(({ data }: { data: WrittenEntry }) => {
        written.push({
          ...data,
          // `Prisma.DbNull` is how a SQL NULL is written; read it back as null.
          before: data.before === Prisma.DbNull ? null : data.before,
          after: data.after === Prisma.DbNull ? null : data.after,
        });
        return Promise.resolve({});
      });
    $transaction
      .mockReset()
      .mockImplementation((work: (client: typeof tx) => Promise<unknown>) =>
        work(tx),
      );
    bookFindUnique.mockReset().mockResolvedValue(bookRow());
    tx.book.create.mockReset().mockResolvedValue(bookRow());
    tx.book.update.mockReset().mockResolvedValue(bookRow());
    tx.book.findUnique.mockReset().mockResolvedValue(bookRow());
    for (const catalog of [tx.author, tx.publisher, tx.genre]) {
      catalog.findFirst.mockReset().mockResolvedValue(null);
      catalog.upsert.mockReset().mockResolvedValue({ id: 'new' });
    }
    findUserByEmail
      .mockReset()
      .mockImplementation((where: { id?: string; email?: string }) =>
        Promise.resolve(
          where.id === USER.id
            ? { ...USER }
            : where.email === USER.email
              ? { ...USER, passwordHash, createdAt }
              : null,
        ),
      );
  });

  describe('books', () => {
    it('POST records CREATE with the user from the token and the ip of the client', async () => {
      await asUser(api().post('/api/books')).send(valid).expect(201);

      expect(written).toEqual([
        {
          action: 'CREATE',
          entity: 'Book',
          entityId: ID,
          before: null,
          after: {
            id: ID,
            title: 'Dune',
            author: 'Frank Herbert',
            publisher: 'Ace',
            genre: 'Ciencia ficción',
            price: 9990.5,
            availability: true,
            imageUrl: null,
          },
          userId: USER.id,
          ip: CLIENT_IP,
        },
      ]);
    });

    it('PATCH records UPDATE with the book before and after', async () => {
      tx.book.update.mockResolvedValue(bookRow({ title: 'Dune Messiah' }));

      await asUser(api().patch(`/api/books/${ID}`))
        .send({ title: 'Dune Messiah' })
        .expect(200);

      expect(written).toHaveLength(1);
      expect(written[0]).toMatchObject({
        action: 'UPDATE',
        entityId: ID,
        before: { title: 'Dune' },
        after: { title: 'Dune Messiah' },
        userId: USER.id,
        ip: CLIENT_IP,
      });
    });

    it('DELETE records DELETE with the book as it was', async () => {
      await asUser(api().delete(`/api/books/${ID}`)).expect(204);

      expect(written).toHaveLength(1);
      expect(written[0]).toMatchObject({
        action: 'DELETE',
        entityId: ID,
        before: { id: ID, title: 'Dune' },
        after: null,
        userId: USER.id,
        ip: CLIENT_IP,
      });
    });

    it('setting a cover records UPDATE with the new imageUrl', async () => {
      tx.book.update.mockImplementation(
        ({ data }: { data: { imageUrl: string } }) =>
          Promise.resolve(bookRow({ imageUrl: data.imageUrl })),
      );

      await asUser(api().post(`/api/books/${ID}/image`))
        .attach('image', PNG, { filename: 'c.png', contentType: 'image/png' })
        .expect(200);

      expect(written).toHaveLength(1);
      expect(written[0]).toMatchObject({
        action: 'UPDATE',
        before: { imageUrl: null },
        after: {
          imageUrl: expect.stringMatching(/^\/api\/uploads\//) as string,
        },
        userId: USER.id,
        ip: CLIENT_IP,
      });
    });

    it('removing a cover records UPDATE with the cover going away', async () => {
      const withCover = bookRow({ imageUrl: '/api/uploads/x.png' });
      bookFindUnique.mockResolvedValue(withCover);
      tx.book.findUnique.mockResolvedValue(withCover);
      tx.book.update.mockResolvedValue(bookRow({ imageUrl: null }));

      await asUser(api().delete(`/api/books/${ID}/image`)).expect(200);

      expect(written[0]).toMatchObject({
        action: 'UPDATE',
        before: { imageUrl: '/api/uploads/x.png' },
        after: { imageUrl: null },
      });
    });

    it('records nothing for reads', async () => {
      bookFindUnique.mockResolvedValue(bookRow());

      await asUser(api().get(`/api/books/${ID}`)).expect(200);

      expect(written).toEqual([]);
    });

    it.each([
      [
        'an invalid body (400)',
        () => asUser(api().post('/api/books')).send({ title: '' }),
        400,
      ],
      [
        'an unknown book (404)',
        () => {
          tx.book.findUnique.mockResolvedValue(null);
          return asUser(api().delete(`/api/books/${ID}`));
        },
        404,
      ],
      [
        'a duplicate (409)',
        () => {
          tx.book.create.mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError('dup', {
              code: 'P2002',
              clientVersion: 'test',
              meta: { modelName: 'Book' },
            }),
          );
          return asUser(api().post('/api/books')).send(valid);
        },
        409,
      ],
      ['no token (401)', () => api().post('/api/books').send(valid), 401],
    ])('records nothing for %s', async (_name, send, status) => {
      await send().expect(status);

      expect(written).toEqual([]);
    });

    it('cannot be given a user or an ip by the client', async () => {
      await asUser(api().post('/api/books'))
        .set('X-User-Id', 'attacker')
        .send({ ...valid, userId: 'attacker', ip: '6.6.6.6' })
        .expect(400);
      expect(written).toEqual([]);

      await asUser(api().post('/api/books'))
        .set('X-User-Id', 'attacker')
        .send(valid)
        .expect(201);
      expect(written[0]).toMatchObject({ userId: USER.id, ip: CLIENT_IP });
    });

    it('undoes the operation when the entry cannot be written', async () => {
      auditCreate.mockRejectedValue(new Error('audit table is gone'));

      const res = await asUser(api().post('/api/books')).send(valid);

      expect(res.status).toBe(500);
      // The error is the generic one: nothing internal reaches the client.
      expect(JSON.stringify(res.body)).not.toContain('audit table');
    });
  });

  describe('logins', () => {
    const login = (body: object) =>
      api()
        .post('/api/auth/login')
        .set('X-Forwarded-For', CLIENT_IP)
        .send(body);

    it('records LOGIN_SUCCESS with the user and the ip', async () => {
      await login({ email: USER.email, password: PASSWORD }).expect(200);

      expect(written).toEqual([
        {
          action: 'LOGIN_SUCCESS',
          entity: 'User',
          entityId: USER.id,
          before: null,
          after: null,
          userId: USER.id,
          ip: CLIENT_IP,
        },
      ]);
    });

    it('records LOGIN_FAILED with the user when the password is wrong', async () => {
      await login({ email: USER.email, password: 'wrong' }).expect(401);

      expect(written).toEqual([
        expect.objectContaining({
          action: 'LOGIN_FAILED',
          entityId: USER.id,
          userId: USER.id,
          ip: CLIENT_IP,
        }),
      ]);
    });

    it('records LOGIN_FAILED without a user when the email does not exist', async () => {
      await login({ email: 'nobody@cmpc.local', password: 'x' }).expect(401);

      expect(written).toEqual([
        expect.objectContaining({
          action: 'LOGIN_FAILED',
          entityId: null,
          userId: null,
          ip: CLIENT_IP,
        }),
      ]);
    });

    it('never stores the typed email, the password or the token', async () => {
      await login({ email: 'typed@example.com', password: 'pw-typed-123' });
      const ok = await login({ email: USER.email, password: PASSWORD }).expect(
        200,
      );

      const everything = JSON.stringify(written);
      expect(everything).not.toContain('typed@example.com');
      expect(everything).not.toContain('pw-typed-123');
      expect(everything).not.toContain(PASSWORD);
      expect(everything).not.toContain(passwordHash);
      expect(everything).not.toContain(USER.email);
      expect(everything).not.toContain(
        (ok.body as { data: { accessToken: string } }).data.accessToken,
      );
    });

    it('answers the same login even when the audit table is down', async () => {
      auditCreate.mockRejectedValue(new Error('audit table is gone'));

      await login({ email: USER.email, password: PASSWORD }).expect(200);
      const bad = await login({ email: USER.email, password: 'wrong' }).expect(
        401,
      );

      expect(bad.body).toMatchObject({
        statusCode: 401,
        message: 'Invalid credentials',
      });
    });

    it('records nothing for a rejected body', async () => {
      await login({ email: 'not-an-email' }).expect(400);

      expect(written).toEqual([]);
    });
  });
});
