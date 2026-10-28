import { ConfigModule } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { configureApp } from './app.setup';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('cover bytes'),
]);
const NAME = '3f6c2a52-7f0e-4c3e-9d57-1d8f0f6a9b11.png';

/**
 * The uploaded covers are served by Express, outside the JWT guard. The real
 * guard is present here so the tests show that the route is public on purpose,
 * and the real files prove what is (and is not) served.
 */
describe('serving the uploaded images', () => {
  let root: string;
  let app: NestExpressApplication;
  const get = (path: string) => request(app.getHttpServer()).get(path);

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'cmpc-serve-'));
    const uploads = join(root, 'uploads');
    await mkdir(uploads);
    await writeFile(join(uploads, NAME), PNG);
    await writeFile(join(uploads, '.hidden.png'), PNG);
    await mkdir(join(uploads, 'sub'));
    await writeFile(join(uploads, 'sub', NAME), PNG);
    // Outside the upload directory: must never be reachable.
    await writeFile(join(root, 'secret.txt'), 'top secret');

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
                JWT_SECRET: 'serve-test-secret-with-at-least-32-characters',
                UPLOAD_DIR: uploads,
              }),
          ],
        }),
        PrismaModule,
        AuthModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({ user: { findUnique: () => Promise.resolve(null) } })
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      logger: false,
    });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await rm(root, { recursive: true, force: true });
  });

  it('serves a stored image without a token', async () => {
    const res = await get(`/api/uploads/${NAME}`).expect(200);

    expect(res.body).toEqual(PNG);
  });

  it('serves it with its real type, a year of cache and nosniff', async () => {
    const res = await get(`/api/uploads/${NAME}`).expect(200);

    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['cache-control']).toBe(
      'public, max-age=31536000, immutable',
    );
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('keeps the security headers of the rest of the API', async () => {
    const res = await get(`/api/uploads/${NAME}`).expect(200);

    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it.each([
    ['jpg', 'image/jpeg'],
    ['webp', 'image/webp'],
  ])('serves a .%s as %s', async (extension, type) => {
    const name = `9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d.${extension}`;
    await writeFile(join(root, 'uploads', name), PNG);

    const res = await get(`/api/uploads/${name}`).expect(200);

    expect(res.headers['content-type']).toBe(type);
  });

  it('answers a HEAD request', async () => {
    await request(app.getHttpServer()).head(`/api/uploads/${NAME}`).expect(200);
  });

  it('answers 404 in the unified format for a file that does not exist', async () => {
    const res = await get(
      '/api/uploads/00000000-0000-4000-8000-000000000000.png',
    );

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ statusCode: 404 });
  });

  it.each([
    ['a path traversal', '/api/uploads/../secret.txt'],
    ['an encoded traversal', '/api/uploads/..%2fsecret.txt'],
    ['a double-encoded traversal', '/api/uploads/%2e%2e%2fsecret.txt'],
    ['a traversal in the middle', `/api/uploads/sub/../../secret.txt`],
    ['a backslash traversal', '/api/uploads/..%5csecret.txt'],
    ['an absolute path', '/api/uploads//etc/passwd'],
    ['a null byte', `/api/uploads/${NAME}%00.txt`],
  ])('never serves a file outside the directory (%s)', async (_label, path) => {
    const res = await get(path);

    expect([400, 403, 404]).toContain(res.status);
    expect(res.text).not.toContain('top secret');
  });

  it('does not serve hidden files', async () => {
    await get('/api/uploads/.hidden.png').expect(404);
  });

  it.each([
    ['/api/uploads/'],
    ['/api/uploads'],
    ['/api/uploads/sub/'],
    ['/api/uploads/sub'],
  ])('does not list or redirect the directory (%s)', async (path) => {
    const res = await get(path);

    expect(res.status).toBe(404);
    expect(res.headers.location).toBeUndefined();
  });

  it('does not accept writes through the static route', async () => {
    const res = await request(app.getHttpServer()).post(`/api/uploads/${NAME}`);

    expect(res.status).toBe(404);
  });

  it('keeps every API route that is not under /api/uploads behind the token', async () => {
    await get('/api/auth/me').expect(401);
  });
});
