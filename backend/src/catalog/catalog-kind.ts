/** The three catalogs a book points to. */
export type CatalogKind = 'author' | 'publisher' | 'genre';

/** What the catalog endpoints return for each entry. */
export interface CatalogItem {
  id: string;
  name: string;
}

/**
 * The part of a Prisma delegate the catalog needs. All three catalogs have the
 * same shape, so one interface serves them and tests can fake it without
 * importing the generated client.
 */
export interface CatalogDelegate {
  findMany(args: {
    where?: { name: { contains: string; mode: 'insensitive' } };
    orderBy: { name: 'asc' };
    take: number;
    select: { id: true; name: true };
  }): Promise<CatalogItem[]>;
  findFirst(args: {
    where: { name: { equals: string; mode: 'insensitive' } };
    select: { id: true };
  }): Promise<{ id: string } | null>;
  upsert(args: {
    where: { name: string };
    update: Record<string, never>;
    create: { name: string };
    select: { id: true };
  }): Promise<{ id: string }>;
}

/** A Prisma client or transaction client, seen only through its catalog delegates. */
export type CatalogClient = Record<CatalogKind, CatalogDelegate>;
