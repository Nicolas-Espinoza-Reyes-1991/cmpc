import { ConfigModule } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from '../app.setup';
import { validateEnv } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

/** Validation and response shape of the catalog routes with the real global pipes. */
describe('catalog over HTTP', () => {
  const findMany = jest.fn();
  let app: NestExpressApplication;

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
                JWT_SECRET: 'http-test-secret-with-at-least-32-characters',
              }),
          ],
        }),
      ],
      controllers: [CatalogController],
      providers: [
        CatalogService,
        {
          provide: PrismaService,
          useValue: {
            author: { findMany },
            publisher: { findMany },
            genre: { findMany },
          },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      logger: false,
    });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    findMany.mockReset().mockResolvedValue([{ id: 'c1', name: 'Planeta' }]);
  });

  it('wraps the list in { data } and uses the default limit of 20', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/publishers')
      .expect(200);

    expect(res.body).toEqual({ data: [{ id: 'c1', name: 'Planeta' }] });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 }),
    );
  });

  it('converts the query text: trims the search and reads limit as a number', async () => {
    await request(app.getHttpServer())
      .get('/api/authors?search=%20%20gabriel%20%20garc%C3%ADa%20&limit=7')
      .expect(200);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: { contains: 'gabriel garcía', mode: 'insensitive' } },
        take: 7,
      }),
    );
  });

  it.each([
    ['limit=0'],
    ['limit=51'],
    ['limit=abc'],
    ['limit=2.5'],
    [`search=${'a'.repeat(101)}`],
    ['unknown=1'],
  ])('rejects %s with 400 and does not query', async (query) => {
    const res = await request(app.getHttpServer())
      .get(`/api/genres?${query}`)
      .expect(400);

    expect(res.body).toMatchObject({ statusCode: 400, path: '/api/genres' });
    expect(findMany).not.toHaveBeenCalled();
  });

  it.each(['post', 'put', 'patch', 'delete'] as const)(
    'offers no way to %s a catalog entry (C6.3)',
    async (method) => {
      const res = await request(app.getHttpServer())[method]('/api/authors');

      expect(res.status).toBe(404);
    },
  );
});
