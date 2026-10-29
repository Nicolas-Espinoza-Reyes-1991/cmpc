import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService, type LoginResult } from './auth.service';

const loginResult: LoginResult = {
  accessToken: 'jwt',
  tokenType: 'Bearer',
  expiresAt: '2026-10-28T03:12:33.000Z',
  user: { id: 'user-1', email: 'admin@cmpc.local' },
};

const ACTOR = { userId: null, ip: '203.0.113.7' };

describe('AuthController', () => {
  const login = jest.fn();
  let controller: AuthController;

  beforeEach(async () => {
    login.mockReset().mockResolvedValue(loginResult);
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: { login } }],
    })
      // The limiter has its own HTTP tests; here only the delegation matters.
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = moduleRef.get(AuthController);
  });

  it('delegates the login to the service with the email and password of the body', async () => {
    const result = await controller.login(
      {
        email: 'admin@cmpc.local',
        password: 'secret',
      },
      ACTOR,
    );

    expect(result).toBe(loginResult);
    expect(login).toHaveBeenCalledWith('admin@cmpc.local', 'secret', ACTOR);
  });

  it('lets a failed login propagate', async () => {
    login.mockRejectedValue(new Error('invalid'));

    await expect(
      controller.login({ email: 'a@b.co', password: 'x' }, ACTOR),
    ).rejects.toThrow('invalid');
  });

  it('returns the user the guard attached to the request', () => {
    const user = { id: 'user-1', email: 'admin@cmpc.local' };

    expect(controller.me(user)).toBe(user);
  });
});
