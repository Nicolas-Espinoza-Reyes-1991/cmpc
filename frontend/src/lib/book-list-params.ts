import type {
  BookListParams,
  SortCriterion,
  SortDirection,
  SortField,
} from '../types/book';

/** Page sizes the screen offers. The API accepts up to 100. */
export const PAGE_SIZES = [10, 20, 50] as const;
export const DEFAULT_LIMIT = PAGE_SIZES[0];

/** The same ceiling as the API: more criteria than this is noise. */
export const MAX_SORT_CRITERIA = 4;

const SORT_FIELDS: readonly SortField[] = [
  'title',
  'author',
  'publisher',
  'genre',
  'price',
  'availability',
  'createdAt',
];

export const DEFAULT_PARAMS: BookListParams = {
  page: 1,
  limit: DEFAULT_LIMIT,
  search: '',
  author: '',
  publisher: '',
  genre: '',
  availability: undefined,
  sort: [],
};

const MAX_TEXT_LENGTH = 100;

const isSortField = (value: string): value is SortField =>
  SORT_FIELDS.some((field) => field === value);

const isDirection = (value: string): value is SortDirection =>
  value === 'asc' || value === 'desc';

/** A filter text as the user typed it: spaces collapsed, within the API's limit. */
const readText = (value: string | null): string =>
  (value ?? '').trim().replace(/\s+/g, ' ').slice(0, MAX_TEXT_LENGTH);

function readPositiveInt(value: string | null, fallback: number): number {
  const number = Number(value);
  return value !== null && Number.isInteger(number) && number >= 1
    ? number
    : fallback;
}

function readLimit(value: string | null): number {
  const number = readPositiveInt(value, DEFAULT_LIMIT);
  return PAGE_SIZES.some((size) => size === number) ? number : DEFAULT_LIMIT;
}

function readAvailability(value: string | null): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

/**
 * `genre:asc,price:desc` as criteria. A text that is not entirely valid gives
 * no criteria at all: half an order would be a surprise.
 */
export function parseSortParam(value: string | null): SortCriterion[] {
  if (!value) return [];
  const criteria: SortCriterion[] = [];
  for (const part of value.split(',')) {
    const pieces = part.split(':');
    const [field, direction] = pieces;
    if (
      pieces.length !== 2 ||
      field === undefined ||
      direction === undefined ||
      !isSortField(field) ||
      !isDirection(direction) ||
      criteria.some((criterion) => criterion.field === field)
    ) {
      return [];
    }
    criteria.push({ field, direction });
  }
  return criteria.length <= MAX_SORT_CRITERIA ? criteria : [];
}

export const formatSort = (sort: readonly SortCriterion[]): string =>
  sort.map(({ field, direction }) => `${field}:${direction}`).join(',');

/**
 * The view described by the URL. Anything invalid (page 0, an unknown order, a
 * strange availability) is ignored and replaced by its default, so a bad or old
 * link opens the listing instead of failing (L4.9).
 */
export function readParams(searchParams: URLSearchParams): BookListParams {
  return {
    page: readPositiveInt(searchParams.get('page'), DEFAULT_PARAMS.page),
    limit: readLimit(searchParams.get('limit')),
    search: readText(searchParams.get('q')),
    author: readText(searchParams.get('author')),
    publisher: readText(searchParams.get('publisher')),
    genre: readText(searchParams.get('genre')),
    availability: readAvailability(searchParams.get('availability')),
    sort: parseSortParam(searchParams.get('sort')),
  };
}

/** The URL of a view: only what differs from the defaults, so links stay short. */
export function writeParams(params: BookListParams): URLSearchParams {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set('q', params.search);
  if (params.author) searchParams.set('author', params.author);
  if (params.publisher) searchParams.set('publisher', params.publisher);
  if (params.genre) searchParams.set('genre', params.genre);
  if (params.availability !== undefined) {
    searchParams.set('availability', String(params.availability));
  }
  if (params.sort.length > 0) searchParams.set('sort', formatSort(params.sort));
  if (params.page !== DEFAULT_PARAMS.page) {
    searchParams.set('page', String(params.page));
  }
  if (params.limit !== DEFAULT_LIMIT) {
    searchParams.set('limit', String(params.limit));
  }
  return searchParams;
}

/**
 * The filters and the order of the view as a query string, without the page:
 * what the export sends (the file holds every match, and the API rejects
 * `page` and `limit` there). Empty values are left out.
 */
export function toExportQuery(
  params: BookListParams,
): Record<string, string | boolean | undefined> {
  return {
    search: params.search || undefined,
    author: params.author || undefined,
    publisher: params.publisher || undefined,
    genre: params.genre || undefined,
    availability: params.availability,
    sort: params.sort.length > 0 ? formatSort(params.sort) : undefined,
  };
}

/** What goes to the API as the query string of a page of the listing. */
export function toApiQuery(
  params: BookListParams,
): Record<string, string | number | boolean | undefined> {
  return { page: params.page, limit: params.limit, ...toExportQuery(params) };
}

/** True when something narrows the listing (the order and the page do not). */
export function hasActiveFilters(params: BookListParams): boolean {
  return (
    params.search !== '' ||
    params.author !== '' ||
    params.publisher !== '' ||
    params.genre !== '' ||
    params.availability !== undefined
  );
}

/**
 * What a click on a column header does to the order: ascending, then
 * descending, then off. A column that was not sorted joins at the end (lowest
 * priority) and, when one is removed, the others move up.
 */
export function cycleSort(
  sort: readonly SortCriterion[],
  field: SortField,
): SortCriterion[] {
  const current = sort.find((criterion) => criterion.field === field);
  if (!current) {
    // At the limit, the oldest criterion makes room for the new one.
    const kept = sort.length >= MAX_SORT_CRITERIA ? sort.slice(1) : [...sort];
    return [...kept, { field, direction: 'asc' }];
  }
  if (current.direction === 'asc') {
    return sort.map((criterion) =>
      criterion.field === field
        ? { field, direction: 'desc' as const }
        : criterion,
    );
  }
  return sort.filter((criterion) => criterion.field !== field);
}
