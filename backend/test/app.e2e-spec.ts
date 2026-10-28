import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Application (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    // e2e tests exercise the real AppModule and global setup; no database is required.
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
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health answers a plain { status: "ok" }', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(res.body).toEqual({ status: 'ok' });
  });

  it('answers unknown routes with the unified error shape', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/does-not-exist')
      .expect(404);

    expect(res.body).toMatchObject({
      statusCode: 404,
      path: '/api/does-not-exist',
    });
  });

  it('publishes the OpenAPI document including the health route', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);

    expect(res.body).toMatchObject({
      paths: { '/api/health': expect.any(Object) as object },
    });
  });
});
