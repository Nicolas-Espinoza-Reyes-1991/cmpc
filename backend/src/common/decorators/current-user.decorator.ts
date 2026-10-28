import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '../types/authenticated-request.types';

/** Exported on its own so it can be tested without building a controller. */
export function currentUserFactory(
  _data: unknown,
  context: ExecutionContext,
): AuthenticatedUser | undefined {
  return context.switchToHttp().getRequest<AuthenticatedRequest>().user;
}

/**
 * The authenticated user of the request. It is `undefined` on `@Public()`
 * routes, so only use it on protected ones.
 */
export const CurrentUser = createParamDecorator(currentUserFactory);
