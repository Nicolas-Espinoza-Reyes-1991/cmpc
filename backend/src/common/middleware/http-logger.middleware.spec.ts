import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  INestApplication,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthenticatedRequest } from '../types/authenticated-request.types';
import { createHttpLogger } from './http-logger.middleware';

class FakeAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    req.user = { id: 'user-1', email: 'user@cmpc.local' };
    return true;
  }
}

class DenyGuard implements CanActivate {
  canActivate(): boolean {
    return false;
  }
}

@Controller('probe')
class ProbeController {
  @Get('ok')
  ok() {
    return { ok: true };
  }

  @Post('login')
  login(@Body() body: unknown) {
    return { received: Boolean(body) };
  }

  @UseGuards(FakeAuthGuard)
  @Get('secure')
  secure() {
    return { ok: true };
  }

  @UseGuards(DenyGuard)
  @Get('denied')
  denied() {
    return { ok: true };
  }

  @Get('boom')
  boom(): never {
    throw new Error('boom');
  }
}

async function buildApp(
  middleware: ReturnType<typeof createHttpLogger>,
): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({
    controllers: [ProbeController],
  }).compile();
  // `logger: false` keeps Nest from printing the deliberate 500 of the /boom route.
  const app = moduleRef.createNestApplication({ logger: false });
  app.use(middleware);
  await app.init();
  return app;
}

/** The `finish` event can land just after the client received the response. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

describe('createHttpLogger', () => {
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await buildApp(createHttpLogger(logger));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logs method, path, status, duration and anonymous user', async () => {
    await request(app.getHttpServer()).get('/probe/ok').expect(200);
    await settle();

    expect(logger.log).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringMatching(
        /^GET \/probe\/ok 200 \d+ms user=anonymous$/,
      ) as string,
    );
  });

  it('never logs the query string', async () => {
    await request(app.getHttpServer()).get('/probe/ok?token=abc&page=1');
    await settle();

    expect(logger.log).toHaveBeenCalledWith(
      expect.stringMatching(/^GET \/probe\/ok 200 /) as string,
    );
    expect(logger.log).toHaveBeenCalledWith(
      expect.not.stringContaining('token') as string,
    );
  });

  it('logs the authenticated user id', async () => {
    await request(app.getHttpServer()).get('/probe/secure').expect(200);
    await settle();

    expect(logger.log).toHaveBeenCalledWith(
      expect.stringMatching(/ user=user-1$/) as string,
    );
  });

  it('warns about requests to unknown routes (404)', async () => {
    await request(app.getHttpServer()).get('/nope').expect(404);
    await settle();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/^GET \/nope 404 \d+ms/) as string,
    );
  });

  it('warns about requests rejected by a guard', async () => {
    await request(app.getHttpServer()).get('/probe/denied').expect(403);
    await settle();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/^GET \/probe\/denied 403 /) as string,
    );
  });

  it('reports server errors at error level', async () => {
    await request(app.getHttpServer()).get('/probe/boom').expect(500);
    await settle();

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringMatching(/^GET \/probe\/boom 500 /) as string,
    );
  });

  it('never leaks request bodies or credentials', async () => {
    await request(app.getHttpServer())
      .post('/probe/login')
      .set('Authorization', 'Bearer secret-token')
      .send({ email: 'a@b.c', password: 'hunter2' });
    await settle();

    expect(logger.log).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalledWith(
      expect.not.stringContaining('hunter2') as string,
    );
    expect(logger.log).toHaveBeenCalledWith(
      expect.not.stringContaining('secret-token') as string,
    );
  });

  it('uses the Nest logger when none is provided', async () => {
    const nestLog = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const defaultApp = await buildApp(createHttpLogger());

    await request(defaultApp.getHttpServer()).get('/probe/ok').expect(200);
    await settle();
    await defaultApp.close();

    expect(nestLog).toHaveBeenCalledWith(
      expect.stringMatching(/^GET \/probe\/ok 200 /) as string,
    );
    nestLog.mockRestore();
  });
});
