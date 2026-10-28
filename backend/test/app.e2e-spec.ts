import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { PasswordHasher } from './../src/auth/password-hasher';
import { PrismaService } from './../src/prisma/prisma.service';

const PASSWORD = 'correct horse battery staple';
const USER = {
  id: '3017f450-2092-454d-9a62-14ad55557302',
  email: 'admin@cmpc.local',
};
/** The only operations reachable without a token. Anything else must answer 401. */
const PUBLIC_OPERATIONS = ['GET /api/health', 'POST /api/auth/login'];
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

interface OpenApiDocument {
  paths: Record<string, Partial<Record<(typeof HTTP_METHODS)[number], object>>>;
}

describe('Application (e2e)', () => {
  let app: NestExpressApplication;
  let passwordHash: string;
  const findUnique = jest.fn(
    ({ where }: { where: { email?: string; id?: string } }) => {
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

  beforeAll(async () => {
    passwordHash = await new PasswordHasher().hash(PASSWORD);
    // e2e tests exercise the real AppModule and global setup; only the database is simulated.
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $queryRaw: jest.fn().mockResolvedValue([]),
        user: { findUnique },
      })
      .compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>({
      logger: false,
    });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('public routes', () => {
    it('GET /api/health answers a plain { status: "ok" } without a token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/health')
        .expect(200);

      expect(res.body).toEqual({ status: 'ok' });
    });

    it('serves the Swagger UI without a token', async () => {
      await request(app.getHttpServer()).get('/api/docs').expect(200);
    });
  });

  describe('protection by default (A3.5)', () => {
    let doc: OpenApiDocument;

    beforeAll(async () => {
      const res = await request(app.getHttpServer()).get('/api/docs-json');
      doc = res.body as OpenApiDocument;
    });

    it('publishes the OpenAPI document with the health and auth routes', () => {
      expect(Object.keys(doc.paths)).toEqual(
        expect.arrayContaining([
          '/api/health',
          '/api/auth/login',
          '/api/auth/me',
        ]),
      );
    });

    it('answers 401 without a token on every documented operation except the public ones', async () => {
      const checked: string[] = [];

      for (const [path, operations] of Object.entries(doc.paths)) {
        for (const method of HTTP_METHODS) {
          if (!operations[method]) continue;
          const operation = `${method.toUpperCase()} ${path}`;
          if (PUBLIC_OPERATIONS.includes(operation)) continue;

          // Path parameters get a well-formed dummy value: the guard runs before any lookup.
          const url = path.replace(
            /\{[^}]+\}/g,
            '00000000-0000-4000-8000-000000000000',
          );
          const res = await request(app.getHttpServer())[method](url);

          expect({ operation, status: res.status }).toEqual({
            operation,
            status: 401,
          });
          checked.push(operation);
        }
      }

      // GET /api/auth/me is the first; every route added later is covered automatically.
      expect(checked).toContain('GET /api/auth/me');
    });

    it('answers unknown routes with the unified 404, not a 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/does-not-exist')
        .expect(404);

      expect(res.body).toMatchObject({
        statusCode: 404,
        path: '/api/does-not-exist',
      });
    });
  });

  describe('login through the whole application', () => {
    it('logs in and uses the token on a protected route', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('X-Forwarded-For', '10.20.0.1')
        .send({ email: USER.email, password: PASSWORD })
        .expect(200);
      const { accessToken } = (login.body as { data: { accessToken: string } })
        .data;

      const me = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(me.body).toEqual({ data: USER });
    });

    it('rejects a wrong password with the unified 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('X-Forwarded-For', '10.20.0.2')
        .send({ email: USER.email, password: 'wrong' })
        .expect(401);

      expect(res.body).toMatchObject({
        statusCode: 401,
        message: 'Invalid credentials',
      });
    });

    it('limits the login with the defaults of the environment (5 per minute per IP)', async () => {
      const attempt = () =>
        request(app.getHttpServer())
          .post('/api/auth/login')
          .set('X-Forwarded-For', '10.20.0.3')
          .send({ email: USER.email, password: 'wrong' });

      for (let i = 0; i < 5; i++) await attempt().expect(401);
      const blocked = await attempt().expect(429);

      expect(blocked.body).toMatchObject({
        statusCode: 429,
        message: 'Too many requests',
      });
      expect(blocked.headers['retry-after']).toBeDefined();
    });
  });
});
