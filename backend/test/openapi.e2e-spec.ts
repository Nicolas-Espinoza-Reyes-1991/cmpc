import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { PrismaService } from './../src/prisma/prisma.service';

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
type Method = (typeof METHODS)[number];

interface Operation {
  summary?: string;
  tags?: string[];
  security?: unknown[];
  responses?: Record<string, { description?: string }>;
}

interface OpenApiDocument {
  info: { title: string; description?: string };
  paths: Record<string, Partial<Record<Method, Operation>>>;
  components: { securitySchemes?: Record<string, { scheme?: string }> };
}

/** The public API, deliberately listed: adding a route means documenting it here too. */
const EXPECTED_OPERATIONS = [
  'POST /api/auth/login',
  'GET /api/auth/me',
  'GET /api/health',
  'GET /api/authors',
  'GET /api/publishers',
  'GET /api/genres',
  'POST /api/books',
  'GET /api/books',
  'GET /api/books/export',
  'GET /api/books/{id}',
  'PATCH /api/books/{id}',
  'DELETE /api/books/{id}',
  'POST /api/books/{id}/image',
  'DELETE /api/books/{id}/image',
];
const PUBLIC_OPERATIONS = ['GET /api/health', 'POST /api/auth/login'];

/** The API documentation cannot fall behind the controllers (D2.3). */
describe('OpenAPI document (e2e)', () => {
  let app: NestExpressApplication;
  let doc: OpenApiDocument;
  const operations = () =>
    Object.entries(doc.paths).flatMap(([path, byMethod]) =>
      METHODS.flatMap((method) => {
        const operation = byMethod[method];
        return operation
          ? [{ name: `${method.toUpperCase()} ${path}`, operation }]
          : [];
      }),
    );

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: jest.fn().mockResolvedValue([]) })
      .compile();
    app = moduleFixture.createNestApplication<NestExpressApplication>({
      logger: false,
    });
    configureApp(app);
    await app.init();
    const res = await request(app.getHttpServer()).get('/api/docs-json');
    doc = res.body as OpenApiDocument;
  });

  afterAll(async () => {
    await app.close();
  });

  it('documents exactly the operations of the API', () => {
    expect(
      operations()
        .map(({ name }) => name)
        .sort(),
    ).toEqual([...EXPECTED_OPERATIONS].sort());
  });

  it('gives every operation a summary and a tag', () => {
    const missing = operations()
      .filter(
        ({ operation }) =>
          !operation.summary?.trim() || !operation.tags?.length,
      )
      .map(({ name }) => name);

    expect(missing).toEqual([]);
  });

  it('declares a described success response on every operation', () => {
    const missing = operations()
      .filter(({ operation }) => {
        const success = Object.entries(operation.responses ?? {}).filter(
          ([status]) => status.startsWith('2'),
        );
        return (
          success.length === 0 ||
          success.some(([, response]) => !response.description?.trim())
        );
      })
      .map(({ name }) => name);

    expect(missing).toEqual([]);
  });

  it('marks every protected operation as secured and documents its 401', () => {
    const protectedOperations = operations().filter(
      ({ name }) => !PUBLIC_OPERATIONS.includes(name),
    );

    const unsecured = protectedOperations
      .filter(
        ({ operation }) =>
          !operation.security?.length || !operation.responses?.['401'],
      )
      .map(({ name }) => name);

    expect(protectedOperations.length).toBeGreaterThan(0);
    expect(unsecured).toEqual([]);
  });

  it('lets Swagger UI authenticate with the token of the login', () => {
    expect(doc.components.securitySchemes?.bearer?.scheme).toBe('bearer');
    expect(doc.info.description).toContain('Authorize');
  });

  it('documents what can go wrong on the health probe', () => {
    const health = doc.paths['/api/health']?.get;

    expect(Object.keys(health?.responses ?? {})).toEqual(
      expect.arrayContaining(['200', '503']),
    );
  });
});
