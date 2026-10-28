import type { AuditAction, Prisma } from '@prisma/client';

/** Who did it and from where. Both are `null` when the request has no such data. */
export interface AuditActor {
  userId: string | null;
  ip: string | null;
}

/** Business data of the record, as plain JSON (never the raw Prisma row). */
export type AuditSnapshot = Prisma.InputJsonObject;

export interface AuditEntry {
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  before?: AuditSnapshot | null;
  after?: AuditSnapshot | null;
  actor: AuditActor;
}

/**
 * What `AuditService.log` writes with: the client of a transaction (so the
 * entry commits or rolls back with the operation) or the service itself. Only
 * the one call it needs is described, which also lets the soft-delete client
 * of the books (a different generated type) be used as is.
 */
export interface AuditClient {
  auditLog: {
    create(args: {
      data: Prisma.AuditLogUncheckedCreateInput;
    }): PromiseLike<unknown>;
  };
}
