import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { JwtStrategy } from './jwt.strategy';

const user = {
  id: '3017f450-2092-454d-9a62-14ad55557302',
  email: 'admin@cmpc.local',
};

describe('JwtStrategy.validate', () => {
  const findById = jest.fn();
  let strategy: JwtStrategy;

  beforeEach(() => {
    findById.mockReset();
    strategy = new JwtStrategy(
      new ConfigService({ JWT_SECRET: 'unit-test-secret' }),
      // Only findById is used; the rest of UsersService is irrelevant here.
      { findById } as unknown as UsersService,
    );
  });

  it('returns the authenticated user when the token belongs to an existing one', async () => {
    findById.mockResolvedValue(user);

    await expect(strategy.validate({ sub: user.id })).resolves.toEqual(user);
    expect(findById).toHaveBeenCalledWith(user.id);
  });

  it('exposes only id and email', async () => {
    findById.mockResolvedValue({ ...user, passwordHash: 'must-not-travel' });

    const result = await strategy.validate({ sub: user.id });

    expect(Object.keys(result).sort()).toEqual(['email', 'id']);
  });

  it('rejects a token whose user no longer exists', async () => {
    findById.mockResolvedValue(null);

    await expect(strategy.validate({ sub: user.id })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it.each([
    ['no sub', {}],
    ['a numeric sub', { sub: 123 }],
    ['an object as sub', { sub: { $ne: null } }],
    ['a null sub', { sub: null }],
  ])('rejects a token with %s without querying', async (_label, payload) => {
    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(findById).not.toHaveBeenCalled();
  });

  it('does not hide a database failure as a 401', async () => {
    findById.mockRejectedValue(new Error('connection lost'));

    await expect(strategy.validate({ sub: user.id })).rejects.toThrow(
      'connection lost',
    );
  });
});
