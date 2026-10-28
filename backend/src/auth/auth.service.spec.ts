import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
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

describe('AuthService', () => {
  const findByEmail = jest.fn();
  const hasher = { hash: jest.fn(), verify: jest.fn() };
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

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: { findByEmail } },
        { provide: JwtService, useValue: jwt },
        { provide: PasswordHasher, useValue: hasher },
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
      const result = await service.login('admin@cmpc.local', 'secret-pass');

      expect(result.tokenType).toBe('Bearer');
      expect(result.user).toEqual({ id: user.id, email: user.email });
      expect(typeof result.accessToken).toBe('string');
    });

    it('checks the password against the stored hash', async () => {
      await service.login('admin@cmpc.local', 'secret-pass');

      expect(hasher.verify).toHaveBeenCalledWith(
        user.passwordHash,
        'secret-pass',
      );
    });

    it('passes the email on as received: normalizing belongs to the users service', async () => {
      await service.login('Admin@CMPC.local', 'secret-pass');

      expect(findByEmail).toHaveBeenCalledWith('Admin@CMPC.local');
    });

    it('signs an HS256 token that carries only sub, iat and exp', async () => {
      const { accessToken } = await service.login(
        'admin@cmpc.local',
        'secret-pass',
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
      );

      const { exp } = jwt.decode<{ exp: number }>(accessToken);
      expect(expiresAt).toBe(new Date(exp * 1000).toISOString());
      const msLeft = Date.parse(expiresAt) - Date.now();
      expect(msLeft).toBeGreaterThan(59 * 60 * 1000);
      expect(msLeft).toBeLessThanOrEqual(60 * 60 * 1000);
    });

    it('never leaks the hash or the password', async () => {
      const result = await service.login('admin@cmpc.local', 'secret-pass');

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

      await expect(service.login('admin@cmpc.local', 'wrong')).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
      expect(hasher.verify).toHaveBeenCalledWith(user.passwordHash, 'wrong');
    });

    it('rejects an email that does not exist', async () => {
      findByEmail.mockResolvedValue(null);
      hasher.verify.mockResolvedValue(false);

      await expect(service.login('nobody@cmpc.local', 'x')).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });

    it('answers exactly the same for an unknown email and a wrong password', async () => {
      hasher.verify.mockResolvedValue(false);
      findByEmail.mockResolvedValueOnce(user);
      const wrongPassword = (await service
        .login('admin@cmpc.local', 'wrong')
        .catch((e: unknown) => e)) as UnauthorizedException;
      findByEmail.mockResolvedValueOnce(null);
      const unknownEmail = (await service
        .login('nobody@cmpc.local', 'wrong')
        .catch((e: unknown) => e)) as UnauthorizedException;

      expect(unknownEmail.getStatus()).toBe(wrongPassword.getStatus());
      expect(unknownEmail.getResponse()).toEqual(wrongPassword.getResponse());
    });

    it('still does the argon2 work for an unknown email, against the dummy hash', async () => {
      findByEmail.mockResolvedValue(null);
      hasher.verify.mockResolvedValue(false);

      await service.login('nobody@cmpc.local', 'whatever').catch(() => null);

      expect(hasher.verify).toHaveBeenCalledTimes(1);
      expect(hasher.verify).toHaveBeenCalledWith(DUMMY_HASH, 'whatever');
    });

    it('does the same single verification for an existing user with a wrong password', async () => {
      findByEmail.mockResolvedValue(user);
      hasher.verify.mockResolvedValue(false);

      await service.login('admin@cmpc.local', 'wrong').catch(() => null);

      expect(hasher.verify).toHaveBeenCalledTimes(1);
    });

    it('never matches an unknown email, even if the dummy hash verified', async () => {
      findByEmail.mockResolvedValue(null);
      hasher.verify.mockResolvedValue(true);

      await expect(service.login('nobody@cmpc.local', 'x')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('does not sign anything when the login fails', async () => {
      const sign = jest.spyOn(jwt, 'signAsync');
      findByEmail.mockResolvedValue(user);
      hasher.verify.mockResolvedValue(false);

      await service.login('admin@cmpc.local', 'wrong').catch(() => null);

      expect(sign).not.toHaveBeenCalled();
    });
  });

  describe('failures that are not wrong credentials', () => {
    it('propagates a database error instead of pretending the login failed', async () => {
      findByEmail.mockRejectedValue(new Error('connection lost'));

      await expect(service.login('admin@cmpc.local', 'x')).rejects.toThrow(
        'connection lost',
      );
    });

    it('fails to start if the dummy hash cannot be built', async () => {
      hasher.hash.mockRejectedValue(new Error('argon2 unavailable'));

      await expect(service.onModuleInit()).rejects.toThrow(
        'argon2 unavailable',
      );
    });
  });
});
