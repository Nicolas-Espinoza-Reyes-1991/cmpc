import type { ConfigService } from '@nestjs/config';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import type { EnvironmentVariables } from '../config/env.validation';

/**
 * At most THROTTLE_LIMIT login attempts every THROTTLE_TTL seconds per IP
 * (A4.1). The library wants milliseconds. The message replaces the default,
 * "ThrottlerException: Too Many Requests", which exposes an internal class name.
 */
export function throttlerModuleOptions(
  config: ConfigService<EnvironmentVariables, true>,
): ThrottlerModuleOptions {
  return {
    throttlers: [
      {
        ttl: config.get('THROTTLE_TTL', { infer: true }) * 1000,
        limit: config.get('THROTTLE_LIMIT', { infer: true }),
      },
    ],
    errorMessage: 'Too many requests',
  };
}
