import { INestApplication, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { RAW_RESPONSE_KEY } from '../common/decorators/raw-response.decorator';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { TransformInterceptor } from '../common/interceptors/transform.interceptor';
import { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  const queryRaw = jest.fn();
  let app: INestApplication<App>;

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        { provide: PrismaService, useValue: { $queryRaw: queryRaw } },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    // Same global pieces as production: the health route must survive both.
    app.useGlobalInterceptors(new TransformInterceptor(app.get(Reflector)));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    queryRaw.mockReset();
  });

  it('answers 200 with a plain { status } body when the database is up', async () => {
    queryRaw.mockResolvedValue([]);

    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(res.body).toEqual({ status: 'ok' });
  });

  it('answers 503 with the unified error shape when the database is down', async () => {
    queryRaw.mockRejectedValue(new Error('down'));

    const res = await request(app.getHttpServer()).get('/health').expect(503);

    expect(res.body).toEqual({
      statusCode: 503,
      message: 'Database unavailable',
      path: '/health',
      timestamp: expect.any(String) as string,
    });
  });

  it('is public and exempt from the response envelope', () => {
    const reflector = new Reflector();
    // Reading metadata needs the function itself; it is never called unbound.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const handler = HealthController.prototype.check;

    expect(reflector.get<boolean>(IS_PUBLIC_KEY, handler)).toBe(true);
    expect(reflector.get<boolean>(RAW_RESPONSE_KEY, handler)).toBe(true);
  });
});
