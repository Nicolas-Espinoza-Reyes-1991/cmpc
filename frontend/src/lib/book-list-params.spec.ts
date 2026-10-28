import type { BookListParams, SortCriterion } from '../types/book';
import {
  cycleSort,
  DEFAULT_PARAMS,
  formatSort,
  hasActiveFilters,
  MAX_SORT_CRITERIA,
  PAGE_SIZES,
  parseSortParam,
  readParams,
  toApiQuery,
  toExportQuery,
  writeParams,
} from './book-list-params';

const read = (query: string) => readParams(new URLSearchParams(query));
const sort = (
  ...items: [SortCriterion['field'], SortCriterion['direction']][]
) => items.map(([field, direction]) => ({ field, direction }));

describe('readParams', () => {
  it('gives the defaults for an empty URL', () => {
    expect(read('')).toEqual(DEFAULT_PARAMS);
  });

  it('reads every parameter', () => {
    expect(
      read(
        'q=dune&author=herbert&publisher=ace&genre=ficci%C3%B3n&availability=false&sort=genre:asc,price:desc&page=3&limit=20',
      ),
    ).toEqual({
      page: 3,
      limit: 20,
      search: 'dune',
      author: 'herbert',
      publisher: 'ace',
      genre: 'ficción',
      availability: false,
      sort: sort(['genre', 'asc'], ['price', 'desc']),
    });
  });

  it.each([['page=0'], ['page=-2'], ['page=1.5'], ['page=abc'], ['page=']])(
    'ignores an invalid page (%s)',
    (query) => {
      expect(read(query).page).toBe(1);
    },
  );

  it.each(PAGE_SIZES)('accepts the page size %s', (limit) => {
    expect(read(`limit=${limit}`).limit).toBe(limit);
  });

  it.each([['limit=5'], ['limit=100'], ['limit=abc'], ['limit=0']])(
    'ignores a page size the screen does not offer (%s)',
    (query) => {
      expect(read(query).limit).toBe(PAGE_SIZES[0]);
    },
  );

  it.each([
    ['true', true],
    ['false', false],
  ])('reads availability=%s', (text, value) => {
    expect(read(`availability=${text}`).availability).toBe(value);
  });

  it.each([['availability=maybe'], ['availability=1'], ['availability=']])(
    'ignores a strange availability (%s)',
    (query) => {
      expect(read(query).availability).toBeUndefined();
    },
  );

  it('normalizes the spaces of the texts and cuts them at 100 characters', () => {
    expect(read('q=%20%20gabriel%20%20garc%C3%ADa%20').search).toBe(
      'gabriel garcía',
    );
    expect(read(`author=${'a'.repeat(150)}`).author).toHaveLength(100);
  });

  it('ignores an order that is not entirely valid', () => {
    expect(read('sort=foo:asc').sort).toEqual([]);
  });
});

describe('parseSortParam', () => {
  it.each([[null], ['']])('gives no criteria for %j', (value) => {
    expect(parseSortParam(value)).toEqual([]);
  });

  it('reads criteria in priority order', () => {
    expect(parseSortParam('price:desc,title:asc')).toEqual(
      sort(['price', 'desc'], ['title', 'asc']),
    );
  });

  it.each([
    ['an unknown field', 'foo:asc'],
    ['an unknown direction', 'title:up'],
    ['a missing direction', 'title'],
    ['an extra colon', 'title:asc:desc'],
    ['a repeated field', 'title:asc,title:desc'],
    ['one bad criterion among good ones', 'title:asc,foo:desc'],
    ['an empty criterion', 'title:asc,'],
    [
      'too many criteria',
      'title:asc,author:asc,genre:asc,price:asc,publisher:asc',
    ],
  ])('discards the whole order for %s', (_label, value) => {
    expect(parseSortParam(value)).toEqual([]);
  });

  it('accepts exactly the maximum number of criteria', () => {
    const value = 'title:asc,author:asc,genre:asc,price:asc';

    expect(parseSortParam(value)).toHaveLength(MAX_SORT_CRITERIA);
  });
});

describe('writeParams', () => {
  it('writes nothing for the defaults', () => {
    expect(writeParams(DEFAULT_PARAMS).toString()).toBe('');
  });

  it('writes only what differs from the defaults', () => {
    const params: BookListParams = {
      ...DEFAULT_PARAMS,
      search: 'dune',
      availability: true,
      page: 2,
    };

    expect(writeParams(params).toString()).toBe(
      'q=dune&availability=true&page=2',
    );
  });

  it('writes the order, the filters and the page size', () => {
    const params: BookListParams = {
      ...DEFAULT_PARAMS,
      author: 'herb',
      publisher: 'ace',
      genre: 'novela',
      availability: false,
      sort: sort(['genre', 'asc'], ['price', 'desc']),
      limit: 50,
    };

    expect(writeParams(params).toString()).toBe(
      'author=herb&publisher=ace&genre=novela&availability=false&sort=genre%3Aasc%2Cprice%3Adesc&limit=50',
    );
  });

  it('reads back what it wrote', () => {
    const params: BookListParams = {
      page: 4,
      limit: 20,
      search: 'cien años',
      author: 'gabriel',
      publisher: 'sudamericana',
      genre: 'novela',
      availability: true,
      sort: sort(['price', 'desc'], ['title', 'asc']),
    };

    expect(readParams(writeParams(params))).toEqual(params);
  });
});

describe('toApiQuery', () => {
  it('sends the page and the size and leaves out what is empty', () => {
    expect(toApiQuery(DEFAULT_PARAMS)).toEqual({
      page: 1,
      limit: 10,
      search: undefined,
      author: undefined,
      publisher: undefined,
      genre: undefined,
      availability: undefined,
      sort: undefined,
    });
  });

  it('sends every filter and the order as field:direction', () => {
    expect(
      toApiQuery({
        page: 2,
        limit: 20,
        search: 'dune',
        author: 'herb',
        publisher: 'ace',
        genre: 'novela',
        availability: false,
        sort: sort(['genre', 'asc'], ['price', 'desc']),
      }),
    ).toEqual({
      page: 2,
      limit: 20,
      search: 'dune',
      author: 'herb',
      publisher: 'ace',
      genre: 'novela',
      availability: false,
      sort: 'genre:asc,price:desc',
    });
  });

  it('sends availability false (a falsy value is still a filter)', () => {
    expect(
      toApiQuery({ ...DEFAULT_PARAMS, availability: false }).availability,
    ).toBe(false);
  });
});

describe('toExportQuery', () => {
  it('sends the filters and the order, never the page or the size', () => {
    const query = toExportQuery({
      page: 3,
      limit: 50,
      search: 'dune',
      author: 'herb',
      publisher: 'ace',
      genre: 'novela',
      availability: false,
      sort: sort(['genre', 'asc'], ['price', 'desc']),
    });

    expect(query).toEqual({
      search: 'dune',
      author: 'herb',
      publisher: 'ace',
      genre: 'novela',
      availability: false,
      sort: 'genre:asc,price:desc',
    });
    expect(query).not.toHaveProperty('page');
    expect(query).not.toHaveProperty('limit');
  });

  it('leaves out what is empty', () => {
    expect(toExportQuery(DEFAULT_PARAMS)).toEqual({
      search: undefined,
      author: undefined,
      publisher: undefined,
      genre: undefined,
      availability: undefined,
      sort: undefined,
    });
  });
});

describe('formatSort', () => {
  it('writes field:direction separated by commas', () => {
    expect(formatSort(sort(['title', 'asc'], ['price', 'desc']))).toBe(
      'title:asc,price:desc',
    );
    expect(formatSort([])).toBe('');
  });
});

describe('hasActiveFilters', () => {
  it('is false for the defaults, the order and the page', () => {
    expect(hasActiveFilters(DEFAULT_PARAMS)).toBe(false);
    expect(
      hasActiveFilters({
        ...DEFAULT_PARAMS,
        page: 5,
        limit: 50,
        sort: sort(['price', 'asc']),
      }),
    ).toBe(false);
  });

  it.each([
    [{ search: 'a' }],
    [{ author: 'a' }],
    [{ publisher: 'a' }],
    [{ genre: 'a' }],
    [{ availability: true }],
    [{ availability: false }],
  ])('is true when %j narrows the listing', (changes) => {
    expect(hasActiveFilters({ ...DEFAULT_PARAMS, ...changes })).toBe(true);
  });
});

describe('cycleSort', () => {
  it('goes ascending, then descending, then off for one column', () => {
    const first = cycleSort([], 'price');
    const second = cycleSort(first, 'price');
    const third = cycleSort(second, 'price');

    expect(first).toEqual(sort(['price', 'asc']));
    expect(second).toEqual(sort(['price', 'desc']));
    expect(third).toEqual([]);
  });

  it('adds a new column at the end, with the lowest priority', () => {
    expect(cycleSort(sort(['genre', 'desc']), 'price')).toEqual(
      sort(['genre', 'desc'], ['price', 'asc']),
    );
  });

  it('keeps the other columns and their priority when one changes direction', () => {
    expect(
      cycleSort(
        sort(['genre', 'asc'], ['price', 'asc'], ['title', 'asc']),
        'price',
      ),
    ).toEqual(sort(['genre', 'asc'], ['price', 'desc'], ['title', 'asc']));
  });

  it('moves the others up when a column is removed', () => {
    expect(
      cycleSort(
        sort(['genre', 'asc'], ['price', 'desc'], ['title', 'asc']),
        'price',
      ),
    ).toEqual(sort(['genre', 'asc'], ['title', 'asc']));
  });

  it('drops the oldest criterion when a fifth column would exceed the limit', () => {
    const full = sort(
      ['title', 'asc'],
      ['author', 'asc'],
      ['genre', 'asc'],
      ['price', 'asc'],
    );

    expect(cycleSort(full, 'publisher')).toEqual(
      sort(
        ['author', 'asc'],
        ['genre', 'asc'],
        ['price', 'asc'],
        ['publisher', 'asc'],
      ),
    );
  });

  it('does not change the list it receives', () => {
    const original = sort(['price', 'asc']);

    cycleSort(original, 'price');

    expect(original).toEqual(sort(['price', 'asc']));
  });
});
