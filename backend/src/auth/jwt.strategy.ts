import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthenticatedUser } from '../common/types/authenticated-request.types';
import type { EnvironmentVariables } from '../config/env.validation';
import { UsersService } from '../users/users.service';
import { JWT_ALGORITHM } from './jwt.config';

/** What a token we signed carries; `sub` is `unknown` because the payload is external input. */
interface JwtPayload {
  sub?: unknown;
}

/**
 * Verifies the Bearer token (signature, HS256 only, expiry) and then loads the
 * user: a valid token for a user that no longer exists is rejected (A2.3). The
 * value returned here becomes `request.user` (A3.3).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<EnvironmentVariables, true>,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
      algorithms: [JWT_ALGORITHM],
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (typeof payload.sub !== 'string') throw new UnauthorizedException();

    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException();

    return { id: user.id, email: user.email };
  }
}
