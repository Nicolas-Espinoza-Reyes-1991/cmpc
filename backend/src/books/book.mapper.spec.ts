import { Prisma } from '@prisma/client';
import { BOOK_INCLUDE, toBookDto, type BookWithCatalogs } from './book.mapper';

const createdAt = new Date('2026-10-28T10:00:00.000Z');
const updatedAt = new Date('2026-10-28T11:00:00.000Z');

const row: BookWithCatalogs = {
  id: 'b1',
  title: 'Cien años de soledad',
  price: new Prisma.Decimal('12990.50'),
  availability: true,
  imageUrl: null,
  authorId: 'a1',
  publisherId: 'p1',
  genreId: 'g1',
  createdAt,
  updatedAt,
  deletedAt: null,
  author: { id: 'a1', name: 'Gabriel García Márquez', createdAt },
  publisher: { id: 'p1', name: 'Editorial Sudamericana', createdAt },
  genre: { id: 'g1', name: 'Novela', createdAt },
};

describe('toBookDto', () => {
  it('returns names instead of ids and the price as a number', () => {
    expect(toBookDto(row)).toEqual({
      id: 'b1',
      title: 'Cien años de soledad',
      author: 'Gabriel García Márquez',
      publisher: 'Editorial Sudamericana',
      genre: 'Novela',
      price: 12990.5,
      availability: true,
      imageUrl: null,
      createdAt,
      updatedAt,
    });
  });

  it('never exposes deletedAt or the foreign keys (C3.2)', () => {
    const dto = toBookDto({ ...row, deletedAt: new Date() });
    for (const hidden of ['deletedAt', 'authorId', 'publisherId', 'genreId']) {
      expect(dto).not.toHaveProperty(hidden);
    }
  });

  it('keeps the image URL when there is one', () => {
    expect(toBookDto({ ...row, imageUrl: '/uploads/b1.png' }).imageUrl).toBe(
      '/uploads/b1.png',
    );
  });

  it('keeps cents exact for the largest allowed price', () => {
    const dto = toBookDto({ ...row, price: new Prisma.Decimal('99999999.99') });

    expect(dto.price).toBe(99_999_999.99);
  });
});

describe('BOOK_INCLUDE', () => {
  it('asks for the three catalogs every book response needs', () => {
    expect(BOOK_INCLUDE).toEqual({
      author: true,
      publisher: true,
      genre: true,
    });
  });
});
