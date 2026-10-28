import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-request.types';

/**
 * Registered globally: every route needs a valid token unless it carries
 * `@Public()`. A route added tomorrow is protected until someone decides
 * otherwise (A3.5).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );

    return isPublic ? true : super.canActivate(context);
  }

  /**
   * Token problems (no header, expired, bad signature) reach here as "no user"
   * and, like an unknown user, get the same generic 401: the reason would only
   * help an attacker.
   *
   * An `err` is different: it is what the strategy threw, either its own 401
   * (user not found) or a real failure such as the database being down. It is
   * rethrown untouched. Turning every error into a 401 would make an outage
   * look like an expired session, and the frontend signs the user out on 401.
   */
  override handleRequest<TUser = AuthenticatedUser>(
    err: Error | null | undefined,
    user: TUser | false,
  ): TUser {
    if (err) throw err;
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
