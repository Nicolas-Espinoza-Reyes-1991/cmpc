import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as reachable without a JWT (login, health). The global JWT
 * guard of the `auth` spec reads this key and lets the request through.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
