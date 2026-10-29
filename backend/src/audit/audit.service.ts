import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuditClient, AuditEntry } from './audit.types';

/**
 * The only code that writes to `audit_logs` (an architecture test enforces
 * it), so the shape of an entry is decided in one place.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Writes an entry with the given client. Inside a transaction it commits or
   * rolls back with the operation it describes, and a failure propagates so the
   * operation is undone too (G2.4).
   */
  async log(client: AuditClient, entry: AuditEntry): Promise<void> {
    await client.auditLog.create({
      data: {
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        // SQL NULL, not the JSON value `null`: "no before" is the absence of data.
        before: entry.before ?? Prisma.DbNull,
        after: entry.after ?? Prisma.DbNull,
        userId: entry.actor.userId,
        ip: entry.actor.ip,
      },
    });
  }

  /**
   * For events that are not part of a data change (logins): a failure to write
   * must not stop the user from entering or turn a 401 into a 500, so it is
   * logged and swallowed (G3.5). The entry's content is left out of the log.
   */
  async logBestEffort(entry: AuditEntry): Promise<void> {
    try {
      await this.log(this.prisma, entry);
    } catch (error) {
      this.logger.error(
        `Could not write the ${entry.action} audit entry: ${String(error)}`,
      );
    }
  }
}
