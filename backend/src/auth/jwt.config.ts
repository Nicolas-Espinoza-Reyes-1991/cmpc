import type { ConfigService } from '@nestjs/config';
import type { JwtModuleOptions } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import type { EnvironmentVariables } from '../config/env.validation';

/** The only algorithm tokens are signed with and accepted under (A2.2). */
export const JWT_ALGORITHM = 'HS256';

/**
 * The env schema only admits values like "1h" or "30m" (a number followed by
 * s, m, h or d), which is exactly the shape `StringValue` describes, so the
 * assertion cannot be wrong at runtime.
 */
function asLifetime(value: string): StringValue {
  return value as StringValue;
}

export function jwtModuleOptions(
  config: ConfigService<EnvironmentVariables, true>,
): JwtModuleOptions {
  return {
    secret: config.get('JWT_SECRET', { infer: true }),
    signOptions: {
      algorithm: JWT_ALGORITHM,
      expiresIn: asLifetime(config.get('JWT_EXPIRES_IN', { infer: true })),
    },
    verifyOptions: { algorithms: [JWT_ALGORITHM] },
  };
}
