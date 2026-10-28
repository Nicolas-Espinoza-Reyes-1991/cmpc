import { Controller, Get, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import * as jsonwebtoken from 'jsonwebtoken';
import request from 'supertest';
import { configureApp } from '../app.setup';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-request.types';
import { validateEnv } from '../config/env.validation';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { jwtModuleOptions } from './jwt.config';
import { JwtStrategy } from './jwt.strategy';

const SECRET = 'http-test-secret-with-at-least-32-characters';
const USER = {
  id: '3017f450-2092-454d-9a62-14ad55557302',
  email: 'admin@cmpc.local',
};

@Controller('probe')
class ProbeController {
  @Public()
  @Get('open')
  open() {
    return { open: true };
  }

  // No decorator: protected by default (A3.5).
  @Get('closed')
  closed(@CurrentUser() user: AuthenticatedUser | undefined) {
    return { user };
  }
}

const encode = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

describe('JWT protection over HTTP (real Passport)', () => {
  const findById = jest.fn();
  let app: NestExpressApplication;
  let jwt: JwtService;

  const get = (path: string, authorization?: string) => {
    const req = request(app.getHttpServer()).get(path);
    return authorization ? req.set('Authorization', authorization) : req;
  };
  const sign = (payload: object, options?: { expiresIn?: number }) =>
    jwt.signAsync(payload, options);

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
                JWT_SECRET: SECRET,
              }),
          ],
        }),
        JwtModule.registerAsync({
          inject: [ConfigService],
          useFactory: jwtModuleOptions,
        }),
      ],
      controllers: [ProbeController],
      providers: [
        JwtStrategy,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: UsersService, useValue: { findById } },
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({
      logger: false,
    });
    configureApp(app);
    await app.init();
    jwt = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    findById.mockReset().mockResolvedValue(USER);
  });

  describe('public routes', () => {
    it('answer without a token', async () => {
      const res = await get('/api/probe/open').expect(200);

      expect(res.body).toEqual({ data: { open: true } });
    });

    it('ignore a garbage token instead of failing', async () => {
      await get('/api/probe/open', 'Bearer not.a.token').expect(200);
    });
  });

  describe('a valid token', () => {
    it('opens a protected route and exposes the user', async () => {
      const token = await sign({ sub: USER.id });

      const res = await get('/api/probe/closed', `Bearer ${token}`).expect(200);

      expect(res.body).toEqual({ data: { user: USER } });
      expect(findById).toHaveBeenCalledWith(USER.id);
    });

    it('shows the user id in the access log', async () => {
      const log = jest.spyOn(Logger.prototype, 'log');
      const token = await sign({ sub: USER.id });

      await get('/api/probe/closed', `Bearer ${token}`).expect(200);
      await new Promise((resolve) => setImmediate(resolve));

      expect(log).toHaveBeenCalledWith(
        expect.stringMatching(
          new RegExp(`^GET /api/probe/closed 200 \\d+ms user=${USER.id}$`),
        ) as string,
      );
    });
  });

  describe('a protected route rejects with the unified 401', () => {
    const expected401 = {
      statusCode: 401,
      message: 'Unauthorized',
      path: '/api/probe/closed',
    };

    it('without Authorization header', async () => {
      const res = await get('/api/probe/closed').expect(401);

      expect(res.body).toMatchObject(expected401);
      expect(findById).not.toHaveBeenCalled();
    });

    it('logs the rejected request as anonymous', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn');

      await get('/api/probe/closed').expect(401);
      await new Promise((resolve) => setImmediate(resolve));

      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^GET \/api\/probe\/closed 401 \d+ms user=anonymous$/,
        ) as string,
      );
    });

    it.each([
      ['a Basic scheme', 'Basic dXNlcjpwYXNz'],
      ['an empty Bearer token', 'Bearer '],
      ['a token without scheme', 'abc.def.ghi'],
      ['a malformed token', 'Bearer not-a-jwt'],
    ])('with %s', async (_label, header) => {
      const res = await get('/api/probe/closed', header).expect(401);

      expect(res.body).toMatchObject(expected401);
    });

    it('with an expired token, without revealing that it expired', async () => {
      const token = await sign({ sub: USER.id }, { expiresIn: -10 });

      const res = await get('/api/probe/closed', `Bearer ${token}`).expect(401);

      expect(res.body).toMatchObject(expected401);
      expect(JSON.stringify(res.body)).not.toMatch(/expired/i);
    });

    it('with a payload swapped under a valid signature', async () => {
      const valid = await sign({ sub: USER.id });
      const [header = '', , signature = ''] = valid.split('.');
      const now = Math.floor(Date.now() / 1000);
      const forgedPayload = encode({
        sub: 'someone-else',
        iat: now,
        exp: now + 3600,
      });

      const res = await get(
        '/api/probe/closed',
        `Bearer ${header}.${forgedPayload}.${signature}`,
      ).expect(401);

      expect(res.body).toMatchObject(expected401);
      expect(findById).not.toHaveBeenCalled();
    });

    it('with an unsigned token (alg: none)', async () => {
      const now = Math.floor(Date.now() / 1000);
      const unsigned = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: USER.id, iat: now, exp: now + 3600 })}.`;

      await get('/api/probe/closed', `Bearer ${unsigned}`).expect(401);
      expect(findById).not.toHaveBeenCalled();
    });

    it('with another HMAC algorithm and the right secret (HS384)', async () => {
      const hs384 = jsonwebtoken.sign({ sub: USER.id }, SECRET, {
        algorithm: 'HS384',
        expiresIn: 3600,
      });

      await get('/api/probe/closed', `Bearer ${hs384}`).expect(401);
      expect(findById).not.toHaveBeenCalled();
    });

    it('with a token signed with another secret', async () => {
      const forged = jsonwebtoken.sign({ sub: USER.id }, 'not-the-secret', {
        algorithm: 'HS256',
        expiresIn: 3600,
      });

      await get('/api/probe/closed', `Bearer ${forged}`).expect(401);
    });

    it.each([
      ['no sub', {}],
      ['a numeric sub', { sub: 123 }],
      ['an object as sub', { sub: { $ne: null } }],
    ])('with a valid signature but %s', async (_label, payload) => {
      const token = await sign(payload);

      await get('/api/probe/closed', `Bearer ${token}`).expect(401);
      expect(findById).not.toHaveBeenCalled();
    });

    it('with a valid token of a user that no longer exists', async () => {
      findById.mockResolvedValue(null);
      const token = await sign({ sub: USER.id });

      const res = await get('/api/probe/closed', `Bearer ${token}`).expect(401);

      expect(res.body).toMatchObject(expected401);
    });
  });

  it('does not turn a database failure into a 401', async () => {
    findById.mockRejectedValue(new Error('connection lost'));
    const token = await sign({ sub: USER.id });

    const res = await get('/api/probe/closed', `Bearer ${token}`).expect(500);

    expect(res.body).toMatchObject({ message: 'Internal server error' });
  });

  it('answers 404, not 401, for a path that does not exist', async () => {
    const res = await get('/api/probe/nowhere').expect(404);

    expect(res.body).toMatchObject({ statusCode: 404 });
  });
});
