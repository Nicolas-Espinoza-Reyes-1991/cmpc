import { ValidationPipe } from '@nestjs/common';
import { validationExceptionFactory } from '../../common/validation/validation-exception.factory';
import { sortMessage } from './is-sort.decorator';
import { ListBooksQueryDto } from './list-books-query.dto';

/** The same pipe configuration as the application (see `configureApp`). */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: validationExceptionFactory,
});

const parse = (query: Record<string, string>): Promise<unknown> =>
  pipe.transform(query, { type: 'query', metatype: ListBooksQueryDto });

/** field -> messages of what failed, from the unified error body. */
async function failures(
  query: Record<string, string>,
): Promise<Record<string, string[]>> {
  try {
    await parse(query);
  } catch (error) {
    const body = (
      error as {
        getResponse(): { errors?: { field: string; messages: string[] }[] };
      }
    ).getResponse();
    return Object.fromEntries(
      (body.errors ?? []).map(({ field, messages }) => [field, messages]),
    );
  }
  return {};
}

describe('ListBooksQueryDto', () => {
  it('uses page 1 and 10 per page when nothing is sent', async () => {
    await expect(parse({})).resolves.toMatchObject({ page: 1, limit: 10 });
  });

  it('reads every parameter, converting the numbers and the boolean', async () => {
    await expect(
      parse({
        page: '3',
        limit: '25',
        search: 'dune',
        author: 'herbert',
        publisher: 'ace',
        genre: 'ficción',
        availability: 'false',
        sort: 'genre:asc,price:desc',
      }),
    ).resolves.toMatchObject({
      page: 3,
      limit: 25,
      search: 'dune',
      author: 'herbert',
      publisher: 'ace',
      genre: 'ficción',
      availability: false,
      sort: 'genre:asc,price:desc',
    });
  });

  describe('page and limit', () => {
    it.each([['1'], ['2'], ['999999']])('accepts page %s', async (page) => {
      expect(await failures({ page })).toEqual({});
    });

    it.each([['0'], ['-1'], ['1.5'], ['abc'], ['']])(
      'rejects page %j',
      async (page) => {
        expect(Object.keys(await failures({ page }))).toEqual(['page']);
      },
    );

    it.each([['1'], ['10'], ['100']])('accepts limit %s', async (limit) => {
      expect(await failures({ limit })).toEqual({});
    });

    it.each([['0'], ['101'], ['-5'], ['2.5'], ['abc']])(
      'rejects limit %j',
      async (limit) => {
        expect(Object.keys(await failures({ limit }))).toEqual(['limit']);
      },
    );
  });

  describe('filters', () => {
    it.each(['search', 'author', 'publisher', 'genre'])(
      'normalizes the spaces of %s',
      async (field) => {
        await expect(
          parse({ [field]: '  gabriel   garcía ' }),
        ).resolves.toMatchObject({ [field]: 'gabriel garcía' });
      },
    );

    it.each(['search', 'author', 'publisher', 'genre'])(
      'accepts 100 characters of %s and rejects 101',
      async (field) => {
        expect(await failures({ [field]: 'a'.repeat(100) })).toEqual({});
        expect(
          Object.keys(await failures({ [field]: 'a'.repeat(101) })),
        ).toEqual([field]);
      },
    );

    it.each(['search', 'author', 'publisher', 'genre'])(
      'lets an empty %s through (it means "no filter")',
      async (field) => {
        await expect(parse({ [field]: '' })).resolves.toMatchObject({
          [field]: '',
        });
      },
    );

    it.each([
      ['true', true],
      ['false', false],
    ])('reads availability=%s as %s', async (text, value) => {
      await expect(parse({ availability: text })).resolves.toMatchObject({
        availability: value,
      });
    });

    it.each([['maybe'], ['1'], ['TRUE'], ['']])(
      'rejects availability=%j',
      async (availability) => {
        expect(Object.keys(await failures({ availability }))).toEqual([
          'availability',
        ]);
      },
    );
  });

  describe('sort', () => {
    it.each([['title:asc'], ['genre:asc,price:desc'], [' title : desc ']])(
      'accepts %j',
      async (sort) => {
        expect(await failures({ sort })).toEqual({});
      },
    );

    it.each([
      ['foo:asc', 'field:direction'],
      ['title:up', 'field:direction'],
      ['title', 'field:direction'],
      ['title:asc,title:desc', 'repeats the field title'],
      ['title:asc,author:asc,genre:asc,price:asc,publisher:asc', 'at most 4'],
    ])('rejects %j with a message that says why', async (sort, reason) => {
      const result = await failures({ sort });

      expect(Object.keys(result)).toEqual(['sort']);
      expect(result.sort?.[0]).toContain(reason);
    });
  });

  it('rejects a parameter that does not exist', async () => {
    expect(Object.keys(await failures({ unknown: '1' }))).toEqual(['unknown']);
  });

  it('reports every invalid parameter at once', async () => {
    expect(
      Object.keys(
        await failures({ page: '0', limit: '500', sort: 'x:y' }),
      ).sort(),
    ).toEqual(['limit', 'page', 'sort']);
  });
});

describe('sortMessage', () => {
  it('names the reason when the text is not a valid sort', () => {
    expect(sortMessage('title:asc,title:desc')).toBe(
      'sort repeats the field title',
    );
  });

  it('has a generic message for a value that is not text', () => {
    expect(sortMessage(42)).toBe('sort is not valid');
  });

  it('has a generic message when asked about a valid sort', () => {
    expect(sortMessage('title:asc')).toBe('sort is not valid');
  });
});
