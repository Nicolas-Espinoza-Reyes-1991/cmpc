import type { Book } from '../types/book';
import { changedFields } from './book-changes';
import type { BookFormValues } from './book-schema';

const book: Book = {
  id: 'b1',
  title: 'Dune',
  author: 'Frank Herbert',
  publisher: 'Ace',
  genre: 'Ciencia ficción',
  price: 9990,
  availability: true,
  imageUrl: null,
  createdAt: '2026-10-28T10:00:00.000Z',
  updatedAt: '2026-10-28T10:00:00.000Z',
};

const same: BookFormValues = {
  title: 'Dune',
  author: 'Frank Herbert',
  publisher: 'Ace',
  genre: 'Ciencia ficción',
  price: 9990,
  availability: true,
};

describe('changedFields', () => {
  it('is empty when nothing changed', () => {
    expect(changedFields(book, same)).toEqual({});
  });

  it.each([
    ['title', 'Dune Messiah'],
    ['author', 'Brian Herbert'],
    ['publisher', 'Plaza'],
    ['genre', 'Novela'],
    ['price', 11000],
    ['availability', false],
  ] as const)('returns only %s when only it changed', (field, value) => {
    expect(changedFields(book, { ...same, [field]: value })).toEqual({
      [field]: value,
    });
  });

  it('returns every field that changed and nothing else', () => {
    expect(
      changedFields(book, { ...same, price: 1, availability: false }),
    ).toEqual({ price: 1, availability: false });
  });

  it('does not touch the fields of the book the form does not edit', () => {
    expect(Object.keys(changedFields(book, { ...same, title: 'x' }))).toEqual([
      'title',
    ]);
  });
});
