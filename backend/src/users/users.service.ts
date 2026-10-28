import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A user without credentials: everything the rest of the app may know about one. */
export type UserSummary = Pick<User, 'id' | 'email'>;

/**
 * The only place that reads the `users` table. Callers that just need to know
 * who someone is use `findById`, which never loads the password hash; only the
 * login needs `findByEmail`, which does.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Emails are stored in lower case (the seed does it), so the lookup lower-cases
   * too: the invariant lives with the data access, not with each caller.
   */
  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
  }

  /**
   * The id column is a UUID: asking PostgreSQL for anything else makes Prisma
   * throw (P2023), which would surface as a 500. A value that is not a UUID
   * cannot belong to a user, so the answer is simply "not found".
   */
  async findById(id: string): Promise<UserSummary | null> {
    if (!UUID_PATTERN.test(id)) return null;

    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true },
    });
  }
}
