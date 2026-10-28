import { Injectable } from '@nestjs/common';
import { escapeLike } from '../common/utils/escape-like';
import { PrismaService } from '../prisma/prisma.service';
import type { CatalogClient, CatalogItem, CatalogKind } from './catalog-kind';

export interface CatalogListOptions {
  search?: string;
  limit: number;
}

/** Authors, publishers and genres: read for suggestions, resolve when a book is saved. */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  list(
    kind: CatalogKind,
    { search, limit }: CatalogListOptions,
  ): Promise<CatalogItem[]> {
    const client: CatalogClient = this.prisma;
    return client[kind].findMany({
      // An empty search means "no filter", not "names containing nothing".
      where: search
        ? { name: { contains: escapeLike(search), mode: 'insensitive' } }
        : undefined,
      orderBy: { name: 'asc' },
      take: limit,
      select: { id: true, name: true },
    });
  }

  /**
   * Returns the id of the catalog entry called `name`, creating it if needed.
   * Meant to run inside the transaction that saves the book (C2.5), so `tx` is
   * the transaction client and a failure later rolls the new entry back too.
   *
   * The lookup ignores case ("planeta" finds "Planeta"). If nothing matches, an
   * `upsert` on the unique name creates it with `INSERT ... ON CONFLICT`, so two
   * requests creating the same new name at once end up with one row and no error.
   *
   * `update: { name }` is deliberate. With `update: {}` Prisma does not use the
   * native statement but a lookup followed by an insert, and 1 in 6 parallel
   * transactions failed with P2002 (found in C-07). Setting the name to itself
   * changes nothing and keeps the upsert atomic.
   */
  async resolve(
    tx: CatalogClient,
    kind: CatalogKind,
    name: string,
  ): Promise<string> {
    const existing = await tx[kind].findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) return existing.id;

    const created = await tx[kind].upsert({
      where: { name },
      update: { name },
      create: { name },
      select: { id: true },
    });
    return created.id;
  }
}
