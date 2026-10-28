import { Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from '../app.setup';
import { validateEnv } from '../config/env.validation';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from './auth.module';
import { PasswordHasher } from './password-hasher';

const PASSWORD = 'correct horse battery staple';
const SECRET = 'auth-http-test-secret-with-at-least-32-chars';
const USER = {
  id: '3017f450-2092-454d-9a62-14ad55557302',
  email: 'admin@cmpc.local',
};
const LOGIN = '/api/auth/login';

let passwordHash: string;
let userExists = true;
const findUnique = jest.fn(
  ({ where }: { where: { email?: string; id?: string } }) => {
    if (!userExists) return Promise.resolve(null);
    if (where.email !== undefined) {
      return Promise.resolve(
        where.email === USER.email
          ? { ...USER, passwordHash, createdAt: new Date() }
          : null,
      );
    }
    return Promise.resolve(where.id === USER.id ? { ...USER } : null);
  },
);

/** The real AuthModule, guard, validation, filter and Swagger; only the database is simulated. */
async function createApp(throttle: {
  limit: number;
  ttl: number;
}): Promise<NestExpressApplication> {
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
              THROTTLE_LIMIT: String(throttle.limit),
              THROTTLE_TTL: String(throttle.ttl),
            }),
        ],
      }),
      PrismaModule,
      AuthModule,
    ],
  })
    .overrideProvider(PrismaService)
    .useValue({ user: { findUnique } })
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({
    logger: false,
  });
  configureApp(app);
  await app.init();
  return app;
}

beforeAll(async () => {
  passwordHash = await new PasswordHasher().hash(PASSWORD);
});

beforeEach(() => {
  userExists = true;
  findUnique.mockClear();
});

describe('auth endpoints over HTTP', () => {
  let app: NestExpressApplication;
  const logged: string[] = [];

  const login = (body: unknown) =>
    request(app.getHttpServer())
      .post(LOGIN)
      .send(body as object);
  const me = (token?: string) => {
    const req = request(app.getHttpServer()).get('/api/auth/me');
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  beforeAll(async () => {
    // A generous limit: these tests are about the endpoints, not the limiter.
    app = await createApp({ limit: 1000, ttl: 60 });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    logged.length = 0;
    jest.restoreAllMocks();
    for (const level of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
      jest
        .spyOn(Logger.prototype, level)
        .mockImplementation((...args: unknown[]) => {
          logged.push(args.map(String).join(' '));
        });
    }
  });

  describe('POST /api/auth/login', () => {
    it('answers 200 with the token, its type, its expiry and the user', async () => {
      const res = await login({ email: USER.email, password: PASSWORD }).expect(
        200,
      );

      expect(Object.keys(res.body as object)).toEqual(['data']);
      expect(res.body).toEqual({
        data: {
          accessToken: expect.stringMatching(
            /^[\w-]+\.[\w-]+\.[\w-]+$/,
          ) as string,
          tokenType: 'Bearer',
          expiresAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) as string,
          user: USER,
        },
      });
    });

    it('accepts the email in any case and with surrounding spaces', async () => {
      await login({ email: '  ADMIN@CMPC.LOCAL ', password: PASSWORD }).expect(
        200,
      );
    });

    it('answers 401 for a wrong password', async () => {
      const res = await login({ email: USER.email, password: 'wrong' }).expect(
        401,
      );

      expect(res.body).toMatchObject({
        statusCode: 401,
        message: 'Invalid credentials',
        path: LOGIN,
      });
    });

    it('gives exactly the same 401 for an email that does not exist', async () => {
      const wrongPassword = await login({
        email: USER.email,
        password: 'wrong',
      }).expect(401);
      const unknownEmail = await login({
        email: 'nobody@cmpc.local',
        password: 'wrong',
      }).expect(401);

      const strip = (body: Record<string, unknown>) => ({
        ...body,
        timestamp: undefined,
      });
      expect(strip(unknownEmail.body as Record<string, unknown>)).toEqual(
        strip(wrongPassword.body as Record<string, unknown>),
      );
    });

    it('never puts the password, the hash or the token in a response or a log', async () => {
      const ok = await login({ email: USER.email, password: PASSWORD }).expect(
        200,
      );
      const bad = await login({
        email: USER.email,
        password: 'hunter2-wrong',
      }).expect(401);
      await new Promise((resolve) => setImmediate(resolve));

      const everything = JSON.stringify([ok.body, bad.body, logged]);
      const { accessToken } = (ok.body as { data: { accessToken: string } })
        .data;
      expect(everything).not.toContain(PASSWORD);
      expect(everything).not.toContain('hunter2-wrong');
      expect(everything).not.toContain(passwordHash);
      expect(JSON.stringify(logged)).not.toContain(accessToken);
      expect(logged.some((line) => line.includes('POST /api/auth/login'))).toBe(
        true,
      );
    });

    describe('validates the body (400 with one entry per field)', () => {
      it('rejects an empty body', async () => {
        const res = await login({}).expect(400);

        expect(res.body).toMatchObject({
          message: 'Validation failed',
          errors: expect.arrayContaining([
            expect.objectContaining({ field: 'email' }),
            expect.objectContaining({ field: 'password' }),
          ]) as unknown[],
        });
      });

      it.each([
        ['an email without format', { email: 'not-an-email', password: 'x' }],
        [
          'an email longer than 254 characters',
          { email: `${'a'.repeat(250)}@b.co`, password: 'x' },
        ],
        ['an empty password', { email: USER.email, password: '' }],
        [
          'a password longer than 128 characters',
          { email: USER.email, password: 'x'.repeat(129) },
        ],
        ['a numeric password', { email: USER.email, password: 12345 }],
        ['an object as email', { email: { $ne: null }, password: 'x' }],
      ])('rejects %s without touching the database', async (_label, body) => {
        const res = await login(body).expect(400);

        expect(res.body).toMatchObject({ statusCode: 400 });
        expect(findUnique).not.toHaveBeenCalled();
      });

      it('rejects properties that are not part of the contract', async () => {
        const res = await login({
          email: USER.email,
          password: PASSWORD,
          isAdmin: true,
        }).expect(400);

        expect(res.body).toMatchObject({
          errors: [
            {
              field: 'isAdmin',
              messages: ['property isAdmin should not exist'],
            },
          ],
        });
      });

      it('accepts a password of exactly 128 characters', async () => {
        await login({ email: USER.email, password: 'x'.repeat(128) }).expect(
          401,
        );
        expect(findUnique).toHaveBeenCalled();
      });
    });
  });

  describe('GET /api/auth/me', () => {
    const tokenFromLogin = async (): Promise<string> => {
      const res = await login({ email: USER.email, password: PASSWORD }).expect(
        200,
      );
      return (res.body as { data: { accessToken: string } }).data.accessToken;
    };

    it('returns the user of the token, and only id and email', async () => {
      const res = await me(await tokenFromLogin()).expect(200);

      expect(res.body).toEqual({ data: USER });
    });

    it('answers 401 without token', async () => {
      const res = await me().expect(401);

      expect(res.body).toMatchObject({
        statusCode: 401,
        message: 'Unauthorized',
        path: '/api/auth/me',
      });
    });

    it('answers 401 once the user has been deleted, even with a valid token', async () => {
      const token = await tokenFromLogin();
      userExists = false;

      await me(token).expect(401);
    });
  });

  describe('Swagger (A7.2)', () => {
    let doc: {
      paths: Record<
        string,
        Record<
          string,
          { responses: Record<string, unknown>; security?: unknown[] }
        >
      >;
      components: {
        schemas: Record<string, { properties: Record<string, unknown> }>;
      };
    };

    beforeAll(async () => {
      const res = await request(app.getHttpServer()).get('/api/docs-json');
      doc = res.body as typeof doc;
    });

    it('documents the login with its four answers', () => {
      const post = doc.paths['/api/auth/login']?.post;

      expect(Object.keys(post?.responses ?? {})).toEqual(
        expect.arrayContaining(['200', '400', '401', '429']),
      );
    });

    it('does not ask for a token on the login but does on /me', () => {
      expect(doc.paths['/api/auth/login']?.post?.security).toBeUndefined();
      expect(doc.paths['/api/auth/me']?.get?.security).toEqual([
        { bearer: [] },
      ]);
    });

    it('describes the request body with an example', () => {
      expect(doc.components.schemas.LoginDto?.properties.email).toMatchObject({
        example: 'admin@cmpc.local',
      });
      expect(
        doc.components.schemas.LoginResponseDto?.properties,
      ).toHaveProperty('accessToken');
    });
  });
});

describe('rate limit on the login (A4)', () => {
  let app: NestExpressApplication;
  let nextIp = 0;
  /** Each test gets its own client IP, so one test's attempts never count in another's. */
  const freshIp = () => `10.1.0.${++nextIp}`;

  const attempt = (ip: string, body: unknown, forwarded = ip) =>
    request(app.getHttpServer())
      .post(LOGIN)
      .set('X-Forwarded-For', forwarded)
      .send(body as object);
  const wrong = { email: USER.email, password: 'wrong' };
  const right = { email: USER.email, password: PASSWORD };

  beforeAll(async () => {
    app = await createApp({ limit: 3, ttl: 60 });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  it('lets THROTTLE_LIMIT attempts through and answers 429 to the next one', async () => {
    const ip = freshIp();

    for (let i = 0; i < 3; i++) await attempt(ip, wrong).expect(401);
    const blocked = await attempt(ip, wrong).expect(429);

    expect(blocked.body).toMatchObject({
      statusCode: 429,
      message: 'Too many requests',
      path: LOGIN,
    });
  });

  it('tells the client how long to wait (Retry-After, in seconds)', async () => {
    const ip = freshIp();
    for (let i = 0; i < 3; i++) await attempt(ip, wrong);

    const blocked = await attempt(ip, wrong).expect(429);

    const retryAfter = Number(blocked.headers['retry-after']);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });

  it('keeps blocking even with the right credentials: the limit is per IP, not per account', async () => {
    const ip = freshIp();
    for (let i = 0; i < 3; i++) await attempt(ip, wrong);

    await attempt(ip, right).expect(429);
  });

  it('counts malformed bodies as attempts too (guards run before validation)', async () => {
    const ip = freshIp();

    for (let i = 0; i < 3; i++) await attempt(ip, {}).expect(400);
    await attempt(ip, {}).expect(429);
  });

  it('does not block another IP', async () => {
    const blockedIp = freshIp();
    for (let i = 0; i < 4; i++) await attempt(blockedIp, wrong);

    await attempt(freshIp(), right).expect(200);
  });

  it('uses the client address nginx saw: prefixing the header does not escape the limit', async () => {
    const ip = freshIp();
    for (let i = 0; i < 3; i++) await attempt(ip, wrong);

    // The proxy appends the real address; whatever the client puts before it is ignored.
    await attempt(ip, wrong, `9.9.9.9, ${ip}`).expect(429);
  });

  it('does not limit the other routes (A4.2)', async () => {
    const ip = freshIp();
    const ok = await attempt(ip, right).expect(200);
    const { accessToken } = (ok.body as { data: { accessToken: string } }).data;
    for (let i = 0; i < 4; i++) await attempt(ip, wrong);
    await attempt(ip, right).expect(429);

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });
});
