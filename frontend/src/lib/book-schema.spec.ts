import {
  bookSchema,
  NAME_MAX_LENGTH,
  normalizeText,
  PRICE_MAX,
  TITLE_MAX_LENGTH,
} from './book-schema';

const valid = {
  title: 'Cien años de soledad',
  author: 'Gabriel García Márquez',
  publisher: 'Editorial Sudamericana',
  genre: 'Novela',
  price: 12990,
  availability: true,
};

/** field -> messages, for the fields that failed. */
function errorsOf(value: unknown): Record<string, string[]> {
  const result = bookSchema.safeParse(value);
  if (result.success) return {};
  const byField: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0]);
    (byField[field] ??= []).push(issue.message);
  }
  return byField;
}

describe('normalizeText', () => {
  it('trims and collapses repeated whitespace', () => {
    expect(normalizeText('  Gabriel   García \t Márquez \n')).toBe(
      'Gabriel García Márquez',
    );
  });
});

describe('bookSchema', () => {
  it('accepts a complete valid book', () => {
    expect(bookSchema.parse(valid)).toEqual(valid);
  });

  it('returns the texts as they will be saved: trimmed and with single spaces', () => {
    const parsed = bookSchema.parse({
      ...valid,
      title: '  Cien   años  ',
      author: ' Gabriel  García ',
    });

    expect(parsed.title).toBe('Cien años');
    expect(parsed.author).toBe('Gabriel García');
  });

  describe.each([
    ['title', 'Ingresa el título.', TITLE_MAX_LENGTH, 'El título'],
    ['author', 'Ingresa el autor.', NAME_MAX_LENGTH, 'El autor'],
    ['publisher', 'Ingresa la editorial.', NAME_MAX_LENGTH, 'La editorial'],
    ['genre', 'Ingresa el género.', NAME_MAX_LENGTH, 'El género'],
  ])('%s', (field, required, max, label) => {
    it.each([[''], ['   '], [undefined], [null], [42]])(
      'asks for it when it is %j',
      (value) => {
        expect(errorsOf({ ...valid, [field]: value })[field]).toEqual([
          required,
        ]);
      },
    );

    it(`accepts ${max} characters and rejects one more, in Spanish`, () => {
      expect(errorsOf({ ...valid, [field]: 'a'.repeat(max) })).toEqual({});
      expect(
        errorsOf({ ...valid, [field]: 'a'.repeat(max + 1) })[field],
      ).toEqual([`${label} no puede superar los ${max} caracteres.`]);
    });

    it('counts the length after the spaces are collapsed', () => {
      const padded = `  ${'a'.repeat(max)}    `;

      expect(errorsOf({ ...valid, [field]: padded })).toEqual({});
    });
  });

  describe('price', () => {
    it.each([0.01, 1, 12990, 1234.5, 99.99, 12990.1, PRICE_MAX])(
      'accepts %s',
      (price) => {
        expect(errorsOf({ ...valid, price })).toEqual({});
      },
    );

    it.each([
      ['an empty box (NaN)', NaN, 'Ingresa un precio válido.'],
      ['text', '12990', 'Ingresa un precio válido.'],
      ['null', null, 'Ingresa un precio válido.'],
      ['Infinity', Infinity, 'Ingresa un precio válido.'],
      ['zero', 0, 'El precio debe ser mayor que 0.'],
      ['a negative number', -5, 'El precio debe ser mayor que 0.'],
      [
        'too large',
        PRICE_MAX + 0.01,
        `El precio no puede superar ${PRICE_MAX.toLocaleString('es-CL')}.`,
      ],
      ['three decimals', 10.123, 'El precio admite como máximo dos decimales.'],
      ['below one cent', 0.009, 'El precio mínimo es 0,01.'],
      ['a tiny exponent number', 1e-7, 'El precio mínimo es 0,01.'],
    ])('rejects %s with one message', (_label, price, message) => {
      expect(errorsOf({ ...valid, price }).price).toEqual([message]);
    });

    it('asks for the price when it is missing', () => {
      const { price: _price, ...without } = valid;
      void _price;

      expect(errorsOf(without).price).toEqual(['Ingresa un precio válido.']);
    });
  });

  describe('availability', () => {
    it.each([true, false])('accepts %s', (availability) => {
      expect(errorsOf({ ...valid, availability })).toEqual({});
    });

    it.each(['true', 1, null, undefined])('rejects %j', (availability) => {
      expect(errorsOf({ ...valid, availability }).availability).toEqual([
        'Indica si el libro está disponible.',
      ]);
    });
  });

  it('reports every invalid field at once', () => {
    expect(Object.keys(errorsOf({}))).toEqual(
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
