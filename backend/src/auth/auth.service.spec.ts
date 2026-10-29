import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { PasswordHasher } from './password-hasher';

const user = {
  id: '3017f450-2092-454d-9a62-14ad55557302',
  email: 'admin@cmpc.local',
  passwordHash: '$argon2id$v=19$stored-hash-of-the-user',
  createdAt: new Date('2026-10-27T00:00:00.000Z'),
};
const DUMMY_HASH = '$argon2id$v=19$dummy-hash-built-at-startup';
const SECRET = 'unit-test-secret';
const ACTOR = { userId: null, ip: '203.0.113.7' };

describe('AuthService', () => {
  const findByEmail = jest.fn();
  const hasher = { hash: jest.fn(), verify: jest.fn() };
  const audit = { logBestEffort: jest.fn() };
  const jwt = new JwtService({
    secret: SECRET,
    signOptions: { algorithm: 'HS256', expiresIn: '1h' },
  });
  let service: AuthService;

  beforeEach(async () => {
    jest.restoreAllMocks();
    findByEmail.mockReset();
    hasher.hash.mockReset().mockResolvedValue(DUMMY_HASH);
    hasher.verify.mockReset();
    audit.logBestEffort.mockReset().mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: { findByEmail } },
        { provide: JwtService, useValue: jwt },
        { provide: PasswordHasher, useValue: hasher },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    await moduleRef.init();
    service = moduleRef.get(AuthService);
  });

  describe('startup', () => {
    it('builds the dummy hash once, from a random password', () => {
      expect(hasher.hash).toHaveBeenCalledTimes(1);
      expect(hasher.hash).toHaveBeenCalledWith(
        expect.stringMatching(/^[0-9a-f]{64}$/) as string,
      );
    });
  });

  describe('with valid credentials', () => {
    beforeEach(() => {
      findByEmail.mockResolvedValue(user);
      hasher.verify.mockResolvedValue(true);
    });

    it('returns a Bearer token and the public data of the user', async () => {
      const result = await service.login(
        'admin@cmpc.local',
        'secret-pass',
        ACTOR,
      );

      expect(result.tokenType).toBe('Bearer');
      expect(result.user).toEqual({ id: user.id, email: user.email });
      expect(typeof result.accessToken).toBe('string');
    });

    it('checks the password against the stored hash', async () => {
      await service.login('admin@cmpc.local', 'secret-pass', ACTOR);

      expect(hasher.verify).toHaveBeenCalledWith(
        user.passwordHash,
        'secret-pass',
      );
    });

    it('passes the email on as received: normalizing belongs to the users service', async () => {
      await service.login('Admin@CMPC.local', 'secret-pass', ACTOR);

      expect(findByEmail).toHaveBeenCalledWith('Admin@CMPC.local');
    });

    it('signs an HS256 token that carries only sub, iat and exp', async () => {
      const { accessToken } = await service.login(
        'admin@cmpc.local',
        'secret-pass',
        ACTOR,
      );

      const header = JSON.parse(
        Buffer.from(accessToken.split('.')[0] ?? '', 'base64url').toString(),
      ) as { alg: string };
      const payload = jwt.verify<Record<string, unknown>>(accessToken, {
        algorithms: ['HS256'],
      });
      expect(header.alg).toBe('HS256');
      expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'sub']);
      expect(payload.sub).toBe(user.id);
    });

    it('reports when the token expires, as an ISO date matching its exp claim', async () => {
      const { accessToken, expiresAt } = await service.login(
        'admin@cmpc.local',
        'secret-pass',
        ACTOR,
      );

      const { exp } = jwt.decode<{ exp: number }>(accessToken);
      expect(expiresAt).toBe(new Date(exp * 1000).toISOString());
      const msLeft = Date.parse(expiresAt) - Date.now();
      expect(msLeft).toBeGreaterThan(59 * 60 * 1000);
      expect(msLeft).toBeLessThanOrEqual(60 * 60 * 1000);
    });

    it('never leaks the hash or the password', async () => {
      const result = await service.login(
        'admin@cmpc.local',
        'secret-pass',
        ACTOR,
      );

      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain(user.passwordHash);
      expect(serialized).not.toContain('secret-pass');
      expect(serialized).not.toContain('passwordHash');
    });
  });

  describe('with invalid credentials', () => {
    it('rejects a wrong password for an existing user', async () => {
      findByEmail.mockResolvedValue(user);
      hasher.verify.mockResolvedValue(false);

      await expect(
        service.login('admin@cmpc.local', 'wrong', ACTOR),
      ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
      expect(hasher.verify).toHaveBeenCalledWith(user.passwordHash, 'wrong');
    });

    it('rejects an email that does not exist', async () => {
      findByEmail.mockResolvedValue(null);
      hasher.verify.mockResolvedValue(false);

      await expect(
        service.login('nobody@cmpc.local', 'x', ACTOR),
      ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
    });

    it('answers exactly the same for an unknown email and a wrong password', async () => {
      hasher.verify.mockResolvedValue(false);
      findByEmail.mockResolvedValueOnce(user);
      const wrongPassword = (await service
        .login('admin@cmpc.local', 'wrong', ACTOR)
        .catch((e: unknown) => e)) as UnauthorizedException;
      findByEmail.mockResolvedValueOnce(null);
      const unknownEmail = (await service
        .login('nobody@cmpc.local', 'wrong', ACTOR)
        .catch((e: unknown) => e)) as UnauthorizedException;

      expect(unknownEmail.getStatus()).toBe(wrongPassword.getStatus());
      expect(unknownEmail.getResponse()).toEqual(wrongPassword.getResponse());
    });

    it('still does the argon2 work for an unknown email, against the dummy hash', async () => {
      findByEmail.mockResolvedValue(null);
      hasher.verify.mockResolvedValue(false);

      await service
        .login('nobody@cmpc.local', 'whatever', ACTOR)
        .catch(() => null);

      expect(hasher.verify).toHaveBeenCalledTimes(1);
      expect(hasher.verify).toHaveBeenCalledWith(DUMMY_HASH, 'whatever');
    });

    it('does the same single verification for an existing user with a wrong password', async () => {
      findByEmail.mockResolvedValue(user);
      hasher.verify.mockResolvedValue(false);

      await service.login('admin@cmpc.local', 'wrong', ACTOR).catch(() => null);

      expect(hasher.verify).toHaveBeenCalledTimes(1);
    });

    it('never matches an unknown email, even if the dummy hash verified', async () => {
      findByEmail.mockResolvedValue(null);
      hasher.verify.mockResolvedValue(true);

      await expect(
        service.login('nobody@cmpc.local', 'x', ACTOR),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('does not sign anything when the login fails', async () => {
      const sign = jest.spyOn(jwt, 'signAsync');
      findByEmail.mockResolvedValue(user);
      hasher.verify.mockResolvedValue(false);

      await service.login('admin@cmpc.local', 'wrong', ACTOR).catch(() => null);

      expect(sign).not.toHaveBeenCalled();
    });
  });

  describe('failures that are not wrong credentials', () => {
    it('propagates a database error instead of pretending the login failed', async () => {
      findByEmail.mockRejectedValue(new Error('connection lost'));

      await expect(
        service.login('admin@cmpc.local', 'x', ACTOR),
      ).rejects.toThrow('connection lost');
    });

    it('fails to start if the dummy hash cannot be built', async () => {
      hasher.hash.mockRejectedValue(new Error('argon2 unavailable'));

      await expect(service.onModuleInit()).rejects.toThrow(
        'argon2 unavailable',
      );
    });
  });

  describe('audit trail', () => {
    const entries = () =>
      audit.logBestEffort.mock.calls.map(([entry]) => entry as unknown);

    it('records LOGIN_SUCCESS with the user and the ip', async () => {
      findByEmail.mockResolvedValue(user);
      hasher.verify.mockResolvedValue(true);

      await service.login('admin@cmpc.local', 'secret-pass', ACTOR);

      expect(entries()).toEqual([
        {
          action: 'LOGIN_SUCCESS',
          entity: 'User',
          entityId: user.id,
          actor: { userId: user.id, ip: '203.0.113.7' },
        },
      ]);
    });

    it('records LOGIN_FAILED with the user when the password is wrong', async () => {
      findByEmail.mockResolvedValue(user);
      hasher.verify.mockResolvedValue(false);

      await service.login('admin@cmpc.local', 'wrong', ACTOR).catch(() => null);

      expect(entries()).toEqual([
        {
          action: 'LOGIN_FAILED',
          entity: 'User',
          entityId: user.id,
          actor: { userId: user.id, ip: '203.0.113.7' },
        },
      ]);
    });

    it('records LOGIN_FAILED without a user when the email does not exist', async () => {
      findByEmail.mockResolvedValue(null);
      hasher.verify.mockResolvedValue(false);

      await service.login('nobody@cmpc.local', 'x', ACTOR).catch(() => null);

      expect(entries()).toEqual([
        {
          action: 'LOGIN_FAILED',
          entity: 'User',
          entityId: null,
          actor: { userId: null, ip: '203.0.113.7' },
        },
      ]);
    });

    it('writes one entry in every outcome, so the work does not reveal which emails exist', async () => {
      hasher.verify.mockResolvedValue(false);
      findByEmail.mockResolvedValueOnce(user);
      await service.login('admin@cmpc.local', 'wrong', ACTOR).catch(() => null);
      findByEmail.mockResolvedValueOnce(null);
      await service
        .login('nobody@cmpc.local', 'wrong', ACTOR)
        .catch(() => null);

      expect(audit.logBestEffort).toHaveBeenCalledTimes(2);
    });

    it('never stores the email that was typed, the password or the token', async () => {
      findByEmail.mockResolvedValue(null);
      hasher.verify.mockResolvedValue(false);
      await service
        .login('someone.typed@this.com', 'my-password-123', ACTOR)
        .catch(() => null);
      findByEmail.mockResolvedValue(user);
      hasher.verify.mockResolvedValue(true);
      const { accessToken } = await service.login(
        'admin@cmpc.local',
        'my-password-123',
        ACTOR,
      );

      const written = JSON.stringify(entries());
      expect(written).not.toContain('someone.typed@this.com');
      expect(written).not.toContain('admin@cmpc.local');
      expect(written).not.toContain('my-password-123');
      expect(written).not.toContain(user.passwordHash);
      expect(written).not.toContain(accessToken);
    });
  });
});
