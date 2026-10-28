import { ValidationPipe } from '@nestjs/common';
import { validationExceptionFactory } from '../../common/validation/validation-exception.factory';
import { CreateBookDto, PRICE_MAX } from './create-book.dto';
import { UpdateBookDto } from './update-book.dto';

/** The same pipe configuration as the application (see `configureApp`). */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: validationExceptionFactory,
});

const valid = {
  title: 'Cien años de soledad',
  author: 'Gabriel García Márquez',
  publisher: 'Editorial Sudamericana',
  genre: 'Novela',
  price: 12990,
  availability: true,
};

/** A copy of `value` without the given key. */
const omit = (value: Record<string, unknown>, key: string) =>
  Object.fromEntries(Object.entries(value).filter(([name]) => name !== key));

const parse = <T>(metatype: new () => T, value: unknown): Promise<unknown> =>
  pipe.transform(value, { type: 'body', metatype });

/** The fields that failed, taken from the unified error body. */
async function failedFields<T>(
  metatype: new () => T,
  value: unknown,
): Promise<string[]> {
  try {
    await parse(metatype, value);
  } catch (error) {
    const body = (
      error as { getResponse(): { errors?: { field: string }[] } }
    ).getResponse();
    return (body.errors ?? []).map(({ field }) => field);
  }
  return [];
}

describe('CreateBookDto', () => {
  it('accepts a complete valid book', async () => {
    await expect(parse(CreateBookDto, valid)).resolves.toMatchObject(valid);
  });

  describe('texts', () => {
    it.each(['title', 'author', 'publisher', 'genre'])(
      'normalizes spaces in %s before validating',
      async (field) => {
        const dto = await parse(CreateBookDto, {
          ...valid,
          [field]: '  Gabriel   García \t Márquez  ',
        });

        expect(dto).toMatchObject({ [field]: 'Gabriel García Márquez' });
      },
    );

    it.each(['title', 'author', 'publisher', 'genre'])(
      'rejects %s when it is missing, empty, only spaces or not text',
      async (field) => {
        const without = omit(valid, field);

        expect(await failedFields(CreateBookDto, without)).toEqual([field]);
        for (const bad of ['', '   ', 42, null, ['x']]) {
          expect(
            await failedFields(CreateBookDto, { ...valid, [field]: bad }),
          ).toEqual([field]);
        }
      },
    );

    it('limits the title to 200 characters and each name to 100', async () => {
      expect(
        await failedFields(CreateBookDto, { ...valid, title: 'a'.repeat(200) }),
      ).toEqual([]);
      expect(
        await failedFields(CreateBookDto, { ...valid, title: 'a'.repeat(201) }),
      ).toEqual(['title']);
      for (const field of ['author', 'publisher', 'genre']) {
        expect(
          await failedFields(CreateBookDto, {
            ...valid,
            [field]: 'a'.repeat(100),
          }),
        ).toEqual([]);
        expect(
          await failedFields(CreateBookDto, {
            ...valid,
            [field]: 'a'.repeat(101),
          }),
        ).toEqual([field]);
      }
    });

    it('measures the length after the spaces are collapsed', async () => {
      const padded = ` ${'a'.repeat(100)}   `;

      expect(
        await failedFields(CreateBookDto, { ...valid, author: padded }),
      ).toEqual([]);
    });
  });

  describe('price', () => {
    it.each([0.01, 1, 12990, 1234.5, 99.99, PRICE_MAX])(
      'accepts %s',
      async (price) => {
        expect(await failedFields(CreateBookDto, { ...valid, price })).toEqual(
          [],
        );
      },
    );

    it.each([
      ['zero', 0],
      ['a negative number', -5],
      ['three decimals', 10.123],
      ['more than the maximum', PRICE_MAX + 0.01],
      ['a huge number', 1e21],
      ['a number written as text', '12990'],
      ['null', null],
      ['a boolean', true],
    ])('rejects %s', async (_label, price) => {
      expect(await failedFields(CreateBookDto, { ...valid, price })).toEqual([
        'price',
      ]);
    });

    it('rejects a missing price', async () => {
      const without = omit(valid, 'price');

      expect(await failedFields(CreateBookDto, without)).toEqual(['price']);
    });

    it('rejects a number so small that it would be stored as 0.00', async () => {
      expect(
        await failedFields(CreateBookDto, { ...valid, price: 1e-7 }),
      ).toEqual(['price']);
    });
  });

  describe('availability', () => {
    it.each([true, false])('accepts %s', async (availability) => {
      expect(
        await failedFields(CreateBookDto, { ...valid, availability }),
      ).toEqual([]);
    });

    it.each(['true', 'false', 1, 0, null, 'yes'])('rejects %j', async (bad) => {
      expect(
        await failedFields(CreateBookDto, { ...valid, availability: bad }),
      ).toEqual(['availability']);
    });

    it('is required', async () => {
      const without = omit(valid, 'availability');

      expect(await failedFields(CreateBookDto, without)).toEqual([
        'availability',
      ]);
    });
  });

  describe('properties the client may not send (C2.2)', () => {
    it.each([
      ['id', '3f6c2a52-7f0e-4c3e-9d57-1d8f0f6a9b11'],
      ['imageUrl', 'https://evil.test/x.png'],
      ['deletedAt', '2026-01-01T00:00:00.000Z'],
      ['createdAt', '2026-01-01T00:00:00.000Z'],
      ['authorId', '3f6c2a52-7f0e-4c3e-9d57-1d8f0f6a9b11'],
      ['unknown', 'x'],
    ])('rejects %s', async (field, value) => {
      expect(
        await failedFields(CreateBookDto, { ...valid, [field]: value }),
      ).toEqual([field]);
    });
  });

  it('reports every failed field at once', async () => {
    const fields = await failedFields(CreateBookDto, {
      title: '',
      author: 5,
      price: -1,
    });

    expect(fields).toEqual(
      expect.arrayContaining([
        'title',
        'author',
        'publisher',
        'genre',
        'price',
        'availability',
      ]),
    );
  });
});

describe('UpdateBookDto', () => {
  it('accepts any single field', async () => {
    for (const [field, value] of Object.entries(valid)) {
      await expect(
        parse(UpdateBookDto, { [field]: value }),
      ).resolves.toMatchObject({ [field]: value });
    }
  });

  it('accepts an empty object (the service rejects it, C4.2)', async () => {
    await expect(parse(UpdateBookDto, {})).resolves.toEqual({});
  });

  it('applies the same rules and normalization to the fields it receives', async () => {
    expect(await failedFields(UpdateBookDto, { price: 10.123 })).toEqual([
      'price',
    ]);
    expect(await failedFields(UpdateBookDto, { title: '   ' })).toEqual([
      'title',
    ]);
    await expect(
      parse(UpdateBookDto, { author: '  Isabel   Allende ' }),
    ).resolves.toEqual({ author: 'Isabel Allende' });
  });

  it.each(['id', 'imageUrl', 'deletedAt'])(
    'rejects %s (C4.5)',
    async (field) => {
      expect(await failedFields(UpdateBookDto, { [field]: 'x' })).toEqual([
        field,
      ]);
    },
  );
});
