import { ValidationPipe } from '@nestjs/common';
import { validationExceptionFactory } from '../../common/validation/validation-exception.factory';
import { ExportBooksQueryDto } from './export-books-query.dto';

/** The same pipe configuration as the application (see `configureApp`). */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: validationExceptionFactory,
});

const parse = (query: Record<string, string>): Promise<unknown> =>
  pipe.transform(query, { type: 'query', metatype: ExportBooksQueryDto });

async function failedFields(query: Record<string, string>): Promise<string[]> {
  try {
    await parse(query);
  } catch (error) {
    const body = (
      error as { getResponse(): { errors?: { field: string }[] } }
    ).getResponse();
    return (body.errors ?? []).map(({ field }) => field);
  }
  return [];
}

describe('ExportBooksQueryDto', () => {
  it('accepts no parameter at all: it exports everything', async () => {
    await expect(parse({})).resolves.toBeInstanceOf(ExportBooksQueryDto);
  });

  it('reads the same filters and order as the listing', async () => {
    await expect(
      parse({
        search: '  dune ',
        author: 'herb',
        publisher: 'ace',
        genre: 'novela',
        availability: 'true',
        sort: 'genre:asc,price:desc',
      }),
    ).resolves.toMatchObject({
      search: 'dune',
      author: 'herb',
      publisher: 'ace',
      genre: 'novela',
      availability: true,
      sort: 'genre:asc,price:desc',
    });
  });

  it.each([
    ['page', '1'],
    ['limit', '10'],
  ])('rejects %s: the export is not paginated', async (field, value) => {
    expect(await failedFields({ [field]: value })).toEqual([field]);
  });

  it.each([
    ['availability', 'maybe'],
    ['sort', 'foo:asc'],
    ['sort', 'title:asc,title:desc'],
    ['search', 'a'.repeat(101)],
    ['author', 'a'.repeat(101)],
  ])('applies the rule of the listing to %s=%s', async (field, value) => {
    expect(await failedFields({ [field]: value })).toEqual([field]);
  });

  it('does not add the defaults of the listing (no page or limit to leak into the query)', async () => {
    const dto = await parse({});

    expect(dto).not.toHaveProperty('page');
    expect(dto).not.toHaveProperty('limit');
  });
});
