import { Body, Controller, Get, Logger, Post } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import request from 'supertest';
import { configureApp, parseCorsOrigins } from './app.setup';
import { validateEnv } from './config/env.validation';

class CreateProbeDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsInt()
  @Min(1)
  price!: number;
}

@Controller('probe')
class ProbeController {
  @Get('ok')
  ok() {
    return { ok: true };
  }

  @Get('boom')
  boom(): never {
    throw new Error('secret internal detail');
  }

  @Post()
  create(@Body() dto: CreateProbeDto) {
    return { title: dto.title, isDto: dto instanceof CreateProbeDto };
  }
}

describe('parseCorsOrigins', () => {
  it('splits, trims and drops empty entries', () => {
    expect(parseCorsOrigins(' http://a.test , http://b.test,, ')).toEqual([
      'http://a.test',
      'http://b.test',
    ]);
  });
});

describe('configureApp', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          // Deterministic configuration, independent of the machine's environment.
          validate: () =>
            validateEnv({
              DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
              JWT_SECRET: 'test-secret',
              CORS_ORIGIN: 'http://allowed.test, http://other.test',
            }),
        }),
      ],
      controllers: [ProbeController],
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

  describe('global prefix and envelope', () => {
    it('serves routes under /api and wraps the answer in { data }', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/probe/ok')
        .expect(200);

      expect(res.body).toEqual({ data: { ok: true } });
    });

    it('does not serve routes without the prefix', async () => {
      const res = await request(app.getHttpServer())
        .get('/probe/ok')
        .expect(404);

      expect(res.body).toMatchObject({ statusCode: 404, path: '/probe/ok' });
    });
  });

  describe('validation', () => {
    it('reports every invalid field in the unified error shape', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/probe')
        .send({ title: '', price: 0 })
        .expect(400);

      expect(res.body).toMatchObject({
        statusCode: 400,
        message: 'Validation failed',
        path: '/api/probe',
        errors: [
          { field: 'title', messages: ['title should not be empty'] },
          { field: 'price', messages: ['price must not be less than 1'] },
        ],
      });
    });

    it('rejects properties that are not declared in the DTO', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/probe')
        .send({ title: 'Dune', price: 10, isAdmin: true })
        .expect(400);

      expect(res.body).toMatchObject({
        errors: [
          { field: 'isAdmin', messages: ['property isAdmin should not exist'] },
        ],
      });
    });

    it('transforms the payload into the DTO class', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/probe')
        .send({ title: 'Dune', price: 10 })
        .expect(201);

      expect(res.body).toEqual({ data: { title: 'Dune', isDto: true } });
    });
  });

  describe('errors', () => {
    it('hides the cause of unexpected errors', async () => {
      jest.spyOn(Logger.prototype, 'error').mockImplementation();

      const res = await request(app.getHttpServer())
        .get('/api/probe/boom')
        .expect(500);

      expect(res.body).toMatchObject({ message: 'Internal server error' });
      expect(JSON.stringify(res.body)).not.toContain('secret internal detail');
      jest.restoreAllMocks();
    });

    it('rejects JSON bodies larger than 100 KB with the unified shape', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/probe')
        .send({ title: 'x'.repeat(150_000), price: 1 })
        .expect(413);

      expect(res.body).toMatchObject({
        statusCode: 413,
        message: 'Payload Too Large',
        path: '/api/probe',
      });
    });

    it('answers malformed JSON with a 400 instead of a 500', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/probe')
        .set('Content-Type', 'application/json')
        .send('{"title": ')
        .expect(400);

      // Nest already maps a JSON SyntaxError to a BadRequestException.
      expect(res.body).toMatchObject({
        statusCode: 400,
        path: '/api/probe',
      });
    });
  });

  describe('security headers', () => {
    it('applies helmet, including its CSP, to the API', async () => {
      const res = await request(app.getHttpServer()).get('/api/probe/ok');

      expect(res.headers['content-security-policy']).toBeDefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('keeps helmet headers on the docs but without the CSP that breaks Swagger UI', async () => {
      const res = await request(app.getHttpServer()).get('/api/docs');

      expect(res.headers['content-security-policy']).toBeUndefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('CORS', () => {
    it.each(['http://allowed.test', 'http://other.test'])(
      'allows the configured origin %s',
      async (origin) => {
        const res = await request(app.getHttpServer())
          .get('/api/probe/ok')
          .set('Origin', origin);

        expect(res.headers['access-control-allow-origin']).toBe(origin);
        expect(res.headers['access-control-expose-headers']).toContain(
          'Content-Disposition',
        );
      },
    );

    it('does not allow any other origin', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/probe/ok')
        .set('Origin', 'http://evil.test');

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('Swagger', () => {
    it('serves the UI at /api/docs', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/docs')
        .expect(200);

      expect(res.headers['content-type']).toContain('text/html');
    });

    it('serves the OpenAPI document with bearer auth', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/docs-json')
        .expect(200);

      expect(res.body).toMatchObject({
        info: { title: 'CMPC Libros API', version: '1.0' },
        paths: { '/api/probe': expect.any(Object) as object },
        components: { securitySchemes: { bearer: { type: 'http' } } },
      });
    });
  });
});
