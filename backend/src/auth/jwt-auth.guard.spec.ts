import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const guard = new JwtAuthGuard(new Reflector());

  describe('handleRequest', () => {
    const user = { id: 'user-1', email: 'admin@cmpc.local' };

    it('hands back the user Passport found', () => {
      expect(guard.handleRequest(null, user)).toBe(user);
    });

    it('answers 401 when Passport found no user (bad or missing token)', () => {
      expect(() => guard.handleRequest(null, false)).toThrow(
        UnauthorizedException,
      );
    });

    it('rethrows a 401 raised by the strategy as it is', () => {
      const unauthorized = new UnauthorizedException();

      expect(() => guard.handleRequest(unauthorized, false)).toThrow(
        unauthorized,
      );
    });

    it('does not disguise a real failure as a 401', () => {
      const outage = new Error('database is down');

      expect(() => guard.handleRequest(outage, false)).toThrow(outage);
      expect(() => guard.handleRequest(outage, false)).not.toThrow(
        UnauthorizedException,
      );
    });

    it('gives an error priority even if a user is present', () => {
      const outage = new Error('boom');

      expect(() => guard.handleRequest(outage, user)).toThrow(outage);
    });

    it('never says why: no "expired", "signature" or "malformed" reaches the client', () => {
      let thrown: UnauthorizedException | undefined;
      try {
        guard.handleRequest(null, false);
      } catch (error) {
        thrown = error as UnauthorizedException; // the only exception this method throws
      }

      expect(thrown?.getStatus()).toBe(401);
      expect(thrown?.message).toBe('Unauthorized');
    });
  });

  describe('canActivate', () => {
    it('lets a @Public() handler through without looking for a token', () => {
      const publicHandler = () => undefined;
      Public()(publicHandler);
      class Controller {}
      const context = new ExecutionContextHost([], Controller, publicHandler);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('lets every handler of a @Public() controller through', () => {
      @Public()
      class OpenController {}
      const context = new ExecutionContextHost(
        [],
        OpenController,
        () => undefined,
      );

      expect(guard.canActivate(context)).toBe(true);
    });
  });
});
