import { Prisma } from '@prisma/client';

/** Operations that read or change existing books by a `where` condition (C5.2). */
const FILTERED_OPERATIONS: ReadonlySet<string> = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
]);

type Where = Record<string, unknown>;

/**
 * Adds `deletedAt: null` to a `where`. A condition that already mentions
 * `deletedAt` is kept as it is, so a future trash view can ask for deleted books.
 */
export function withActiveFilter(where: Where | undefined): Where {
  if (where?.deletedAt !== undefined) return where;
  return { ...where, deletedAt: null };
}

type Query = (args: object) => Promise<unknown>;

const isWhere = (value: unknown): value is Where =>
  typeof value === 'object' && value !== null;

/** Exported on its own so the rule can be tested without a database. */
export function applySoftDelete(
  operation: string,
  args: object,
  query: Query,
): Promise<unknown> {
  if (!FILTERED_OPERATIONS.has(operation)) return query(args);
  const where = 'where' in args && isWhere(args.where) ? args.where : undefined;
  return query({ ...args, where: withActiveFilter(where) });
}

/**
 * Hides deleted books from every read and from update/delete, so a service
 * cannot forget the filter. Updating an already deleted book finds no row
 * (Prisma `P2025`, answered as 404) instead of bringing it back.
 */
export const softDeleteExtension = Prisma.defineExtension({
  name: 'soft-delete',
  query: {
    book: {
      $allOperations: ({ operation, args, query }) =>
        // Prisma types `query` for the union of every book operation, which no
        // single signature accepts; the runtime contract is `query(args)`.
        applySoftDelete(operation, args, query as Query),
    },
  },
});
