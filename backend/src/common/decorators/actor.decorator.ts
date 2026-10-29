import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuditActor } from '../../audit/audit.types';
import type { AuthenticatedRequest } from '../types/authenticated-request.types';

/** Exported on its own so it can be tested without building a controller. */
export function actorFactory(
  _data: unknown,
  context: ExecutionContext,
): AuditActor {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
  // `request.ip` is the client's: the app trusts exactly one proxy hop (nginx).
  return { userId: request.user?.id ?? null, ip: request.ip ?? null };
}

/**
 * Who is making the request, for the audit trail. Both come from the server
 * (the verified token and the connection), never from the body.
 */
export const Actor = createParamDecorator(actorFactory);
