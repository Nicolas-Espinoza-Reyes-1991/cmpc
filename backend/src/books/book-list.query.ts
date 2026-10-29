import type { Prisma } from '@prisma/client';
import { escapeLike } from '../common/utils/escape-like';

/** The columns a listing can be ordered by. */
export const SORT_FIELDS = [
  'title',
  'author',
  'publisher',
  'genre',
  'price',
  'availability',
  'createdAt',
] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export type SortDirection = 'asc' | 'desc';

export interface SortCriterion {
  field: SortField;
  direction: SortDirection;
}

/** More criteria than this are noise: nobody reads a table sorted by five columns. */
export const MAX_SORT_CRITERIA = 4;

export type ParsedSort =
  { ok: true; criteria: SortCriterion[] } | { ok: false; reason: string };

const isSortField = (value: string | undefined): value is SortField =>
  SORT_FIELDS.some((field) => field === value);

const isDirection = (value: string | undefined): value is SortDirection =>
  value === 'asc' || value === 'desc';

const FORMAT_HINT = `sort must be a comma-separated list of field:direction (fields: ${SORT_FIELDS.join(', ')}; directions: asc, desc)`;

/**
 * Reads `sort=genre:asc,price:desc` into criteria, in priority order. An empty
 * text means "no criteria". It returns the reason instead of throwing so the
 * DTO validator can use the same function for its message.
 */
export function parseSort(text: string): ParsedSort {
  const parts = text
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
  if (parts.length > MAX_SORT_CRITERIA) {
    return {
      ok: false,
      reason: `sort accepts at most ${MAX_SORT_CRITERIA} criteria`,
    };
  }

  const criteria: SortCriterion[] = [];
  for (const part of parts) {
    const pieces = part.split(':').map((piece) => piece.trim());
    const [field, direction] = pieces;
    if (pieces.length !== 2 || !isSortField(field) || !isDirection(direction)) {
      return { ok: false, reason: FORMAT_HINT };
    }
    if (criteria.some((criterion) => criterion.field === field)) {
      return { ok: false, reason: `sort repeats the field ${field}` };
    }
    criteria.push({ field, direction });
  }
  return { ok: true, criteria };
}

/**
 * The criteria of a `sort` text, or none when there is no text or it is not
 * valid (the DTO rejects an invalid one before it gets here, so the listing
 * never silently drops a criterion the client asked for).
 */
export function sortCriteria(text: string | undefined): SortCriterion[] {
  const parsed = parseSort(text ?? '');
  return parsed.ok ? parsed.criteria : [];
}

/** What the listing can be filtered by. Empty texts mean "no filter". */
export interface BookFilters {
  search?: string;
  author?: string;
  publisher?: string;
  genre?: string;
  availability?: boolean;
}

const contains = (text: string) => ({
  contains: escapeLike(text),
  mode: 'insensitive' as const,
});

/**
 * The `where` of the listing: every filter that is present, all at once. A pure
 * function, so a new filter is one more line here and nothing else changes.
 * Deleted books are hidden by `prisma.live`, not here.
 */
export function buildBookWhere(filters: BookFilters): Prisma.BookWhereInput {
  const conditions: Prisma.BookWhereInput[] = [];
  if (filters.search) conditions.push({ title: contains(filters.search) });
  if (filters.author) {
    conditions.push({ author: { name: contains(filters.author) } });
  }
  if (filters.publisher) {
    conditions.push({ publisher: { name: contains(filters.publisher) } });
  }
  if (filters.genre) {
    conditions.push({ genre: { name: contains(filters.genre) } });
  }
  if (filters.availability !== undefined) {
    conditions.push({ availability: filters.availability });
  }
  return conditions.length > 0 ? { AND: conditions } : {};
}

function toOrderBy(
  criterion: SortCriterion,
): Prisma.BookOrderByWithRelationInput {
  const { field, direction } = criterion;
  switch (field) {
    case 'author':
      return { author: { name: direction } };
    case 'publisher':
      return { publisher: { name: direction } };
    case 'genre':
      return { genre: { name: direction } };
    case 'title':
      return { title: direction };
    case 'price':
      return { price: direction };
    case 'availability':
      return { availability: direction };
    case 'createdAt':
      return { createdAt: direction };
  }
}

/**
 * The `orderBy` of the listing. Without criteria the newest book comes first,
 * and `id` is always the last criterion: two books that tie on everything else
 * would otherwise come in any order, and a page could repeat or skip rows of
 * the next one.
 */
export function buildBookOrderBy(
  criteria: readonly SortCriterion[],
): Prisma.BookOrderByWithRelationInput[] {
  const orderBy =
    criteria.length > 0
      ? criteria.map(toOrderBy)
      : [{ createdAt: 'desc' as const }];
  return [...orderBy, { id: 'asc' }];
}
