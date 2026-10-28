import {
  buildBookOrderBy,
  buildBookWhere,
  MAX_SORT_CRITERIA,
  parseSort,
  SORT_FIELDS,
  type SortCriterion,
} from './book-list.query';

describe('parseSort', () => {
  it('reads the criteria in priority order', () => {
    expect(parseSort('genre:asc,price:desc')).toEqual({
      ok: true,
      criteria: [
        { field: 'genre', direction: 'asc' },
        { field: 'price', direction: 'desc' },
      ],
    });
  });

  it.each(SORT_FIELDS)('accepts the field %s in both directions', (field) => {
    expect(parseSort(`${field}:asc`)).toEqual({
      ok: true,
      criteria: [{ field, direction: 'asc' }],
    });
    expect(parseSort(`${field}:desc`)).toEqual({
      ok: true,
      criteria: [{ field, direction: 'desc' }],
    });
  });

  it('ignores spaces and empty parts', () => {
    expect(parseSort(' title : asc ,, price:desc ,')).toMatchObject({
      ok: true,
      criteria: [
        { field: 'title', direction: 'asc' },
        { field: 'price', direction: 'desc' },
      ],
    });
  });

  it.each([[''], [' '], [',']])('reads %j as "no criteria"', (text) => {
    expect(parseSort(text)).toEqual({ ok: true, criteria: [] });
  });

  it.each([
    ['an unknown field', 'foo:asc'],
    ['an unknown direction', 'title:up'],
    ['a missing direction', 'title'],
    ['an empty direction', 'title:'],
    ['an empty field', ':asc'],
    ['an extra colon', 'title:asc:desc'],
    ['a field with another case', 'Title:asc'],
    ['an internal column', 'deletedAt:asc'],
    ['an id', 'id:asc'],
  ])('rejects %s', (_label, text) => {
    const result = parseSort(text);

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      reason: expect.stringContaining('field:direction') as unknown,
    });
  });

  it('rejects a repeated field and names it', () => {
    expect(parseSort('title:asc,title:desc')).toEqual({
      ok: false,
      reason: 'sort repeats the field title',
    });
  });

  it('accepts exactly the maximum number of criteria and rejects one more', () => {
    const fields = SORT_FIELDS.slice(0, MAX_SORT_CRITERIA + 1);
    const text = (count: number) =>
      fields
        .slice(0, count)
        .map((field) => `${field}:asc`)
        .join(',');

    expect(parseSort(text(MAX_SORT_CRITERIA)).ok).toBe(true);
    expect(parseSort(text(MAX_SORT_CRITERIA + 1))).toEqual({
      ok: false,
      reason: `sort accepts at most ${MAX_SORT_CRITERIA} criteria`,
    });
  });
});

describe('buildBookWhere', () => {
  const insensitive = (text: string) => ({
    contains: text,
    mode: 'insensitive',
  });

  it('adds no condition when there is no filter', () => {
    expect(buildBookWhere({})).toEqual({});
  });

  it.each([[''], [undefined]])(
    'ignores an empty or missing text (%j)',
    (empty) => {
      expect(
        buildBookWhere({
          search: empty,
          author: empty,
          publisher: empty,
          genre: empty,
        }),
      ).toEqual({});
    },
  );

  it('searches the title, ignoring case', () => {
    expect(buildBookWhere({ search: 'dune' })).toEqual({
      AND: [{ title: insensitive('dune') }],
    });
  });

  it('filters by the name of the author, publisher and genre', () => {
    expect(
      buildBookWhere({ author: 'herb', publisher: 'ace', genre: 'ciencia' }),
    ).toEqual({
      AND: [
        { author: { name: insensitive('herb') } },
        { publisher: { name: insensitive('ace') } },
        { genre: { name: insensitive('ciencia') } },
      ],
    });
  });

  it.each([true, false])('filters by availability %s', (availability) => {
    expect(buildBookWhere({ availability })).toEqual({
      AND: [{ availability }],
    });
  });

  it('keeps availability false: a falsy value is still a filter', () => {
    expect(buildBookWhere({ availability: false })).not.toEqual({});
  });

  it('combines every filter at once', () => {
    const where = buildBookWhere({
      search: 'dune',
      author: 'herb',
      availability: true,
    });

    expect(where).toEqual({
      AND: [
        { title: insensitive('dune') },
        { author: { name: insensitive('herb') } },
        { availability: true },
      ],
    });
  });

  it('treats the wildcards of LIKE as plain text', () => {
    expect(buildBookWhere({ search: '100%_a\\' })).toEqual({
      AND: [{ title: insensitive('100\\%\\_a\\\\') }],
    });
  });
});

describe('buildBookOrderBy', () => {
  const criteria = (...items: [SortCriterion['field'], 'asc' | 'desc'][]) =>
    items.map(([field, direction]) => ({ field, direction }));

  it('shows the newest book first when there are no criteria, with id as tiebreaker', () => {
    expect(buildBookOrderBy([])).toEqual([
      { createdAt: 'desc' },
      { id: 'asc' },
    ]);
  });

  it('always ends with id so the order is deterministic', () => {
    const orderBy = buildBookOrderBy(criteria(['price', 'asc']));

    expect(orderBy.at(-1)).toEqual({ id: 'asc' });
    expect(orderBy).toHaveLength(2);
  });

  it('keeps the priority of the criteria', () => {
    expect(
      buildBookOrderBy(criteria(['price', 'desc'], ['title', 'asc'])),
    ).toEqual([{ price: 'desc' }, { title: 'asc' }, { id: 'asc' }]);
  });

  it.each([
    [['author', 'asc'], { author: { name: 'asc' } }],
    [['publisher', 'desc'], { publisher: { name: 'desc' } }],
    [['genre', 'asc'], { genre: { name: 'asc' } }],
    [['title', 'desc'], { title: 'desc' }],
    [['price', 'asc'], { price: 'asc' }],
    [['availability', 'desc'], { availability: 'desc' }],
    [['createdAt', 'asc'], { createdAt: 'asc' }],
  ] as const)('orders by %j as %j', ([field, direction], expected) => {
    expect(buildBookOrderBy([{ field, direction }])[0]).toEqual(expected);
  });
});
