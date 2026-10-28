import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import { JWT_ALGORITHM, jwtModuleOptions } from './jwt.config';

const SECRET = 'a-secret-of-the-test-environment';

async function buildJwtService(expiresIn = '30m'): Promise<JwtService> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      // Only the values below: nothing from the machine's environment leaks in.
      ConfigModule.forRoot({
        // Global, as in AppModule: JwtModule's factory injects ConfigService.
        isGlobal: true,
        ignoreEnvFile: true,
        ignoreEnvVars: true,
        load: [() => ({ JWT_SECRET: SECRET, JWT_EXPIRES_IN: expiresIn })],
      }),
      JwtModule.registerAsync({
        inject: [ConfigService],
        useFactory: jwtModuleOptions,
      }),
    ],
  }).compile();
  return moduleRef.get(JwtService);
}

describe('jwtModuleOptions', () => {
  it('signs with HS256', () => {
    expect(JWT_ALGORITHM).toBe('HS256');
  });

  it('builds a service that signs HS256 tokens with the configured lifetime', async () => {
    const service = await buildJwtService('30m');

    const token = await service.signAsync({ sub: 'user-1' });
    const header = JSON.parse(
      Buffer.from(token.split('.')[0] ?? '', 'base64url').toString(),
    ) as { alg: string };
    const { iat, exp } = service.decode<{ iat: number; exp: number }>(token);

    expect(header.alg).toBe('HS256');
    expect(exp - iat).toBe(30 * 60);
  });

  it('honours another lifetime from the environment', async () => {
    const service = await buildJwtService('2h');

    const token = await service.signAsync({ sub: 'user-1' });
    const { iat, exp } = service.decode<{ iat: number; exp: number }>(token);

    expect(exp - iat).toBe(2 * 60 * 60);
  });

  it('verifies the tokens it signs', async () => {
    const service = await buildJwtService();

    const token = await service.signAsync({ sub: 'user-1' });

    await expect(
      service.verifyAsync<{ sub: string }>(token),
    ).resolves.toMatchObject({ sub: 'user-1' });
  });

  describe('verification is restricted to HS256 even when the caller does not ask', () => {
    it('rejects a token signed with another HMAC algorithm and the right secret', async () => {
      const service = await buildJwtService();
      const hs384 = jwt.sign({ sub: 'attacker' }, SECRET, {
        algorithm: 'HS384',
      });

      await expect(service.verifyAsync(hs384)).rejects.toThrow(
        /invalid algorithm/,
      );
    });

    it('rejects an unsigned token (alg: none)', async () => {
      const service = await buildJwtService();
      const encode = (value: object) =>
        Buffer.from(JSON.stringify(value)).toString('base64url');
      const unsigned = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: 'attacker' })}.`;

      await expect(service.verifyAsync(unsigned)).rejects.toThrow();
    });

    it('rejects a token signed with another secret', async () => {
      const service = await buildJwtService();
      const forged = jwt.sign({ sub: 'attacker' }, 'not-the-secret', {
        algorithm: 'HS256',
      });

      await expect(service.verifyAsync(forged)).rejects.toThrow(
        /invalid signature/,
      );
    });

    it('rejects an expired token', async () => {
      const service = await buildJwtService();
      const expired = await service.signAsync({ sub: 'u' }, { expiresIn: -5 });

      await expect(service.verifyAsync(expired)).rejects.toThrow(/expired/);
    });
  });
});
