import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { CatalogService } from '../catalog/catalog.service';
import { PrismaService } from '../prisma/prisma.service';
import type { BookWithCatalogs } from './book.mapper';
import { BooksService } from './books.service';
import type { CreateBookDto } from './dto/create-book.dto';

const createdAt = new Date('2026-10-28T10:00:00.000Z');

const row: BookWithCatalogs = {
  id: 'b1',
  title: 'Cien años de soledad',
  price: new Prisma.Decimal('12990'),
  availability: true,
  imageUrl: null,
  authorId: 'a-id',
  publisherId: 'p-id',
  genreId: 'g-id',
  createdAt,
  updatedAt: createdAt,
  deletedAt: null,
  author: { id: 'a-id', name: 'Gabriel García Márquez', createdAt },
  publisher: { id: 'p-id', name: 'Editorial Sudamericana', createdAt },
  genre: { id: 'g-id', name: 'Novela', createdAt },
};

const input: CreateBookDto = {
  title: 'Cien años de soledad',
  author: 'Gabriel García Márquez',
  publisher: 'Editorial Sudamericana',
  genre: 'Novela',
  price: 12990,
  availability: true,
};

const prismaError = (code: string, modelName = 'Book') =>
  new Prisma.PrismaClientKnownRequestError('boom', {
    code,
    clientVersion: 'test',
    meta: { modelName },
  });

describe('BooksService', () => {
  // The transaction client handed to the callbacks; `live.book` is the plain read client.
  const tx = { book: { create: jest.fn(), update: jest.fn() } };
  const findUnique = jest.fn();
  const $transaction = jest.fn();
  const resolve = jest.fn();
  let service: BooksService;

  beforeEach(async () => {
    tx.book.create.mockReset().mockResolvedValue(row);
    tx.book.update.mockReset().mockResolvedValue(row);
    findUnique.mockReset().mockResolvedValue(row);
    $transaction
      .mockReset()
      .mockImplementation((work: (client: typeof tx) => Promise<unknown>) =>
        work(tx),
      );
    resolve
      .mockReset()
      .mockImplementation((_tx: unknown, kind: string) =>
        Promise.resolve(`${kind[0]}-id`),
      );

    const moduleRef = await Test.createTestingModule({
      providers: [
        BooksService,
        {
          provide: PrismaService,
          useValue: { live: { $transaction, book: { findUnique } } },
        },
        { provide: CatalogService, useValue: { resolve } },
      ],
    }).compile();
    service = moduleRef.get(BooksService);
  });

  describe('create', () => {
    it('resolves the three catalogs and creates the book in one transaction', async () => {
      const book = await service.create(input);

      expect($transaction).toHaveBeenCalledTimes(1);
      expect(resolve).toHaveBeenNthCalledWith(
        1,
        tx,
        'author',
        'Gabriel García Márquez',
      );
      expect(resolve).toHaveBeenNthCalledWith(
        2,
        tx,
        'publisher',
        'Editorial Sudamericana',
      );
      expect(resolve).toHaveBeenNthCalledWith(3, tx, 'genre', 'Novela');
      expect(tx.book.create).toHaveBeenCalledWith({
        data: {
          title: 'Cien años de soledad',
          price: 12990,
          availability: true,
          authorId: 'a-id',
          publisherId: 'p-id',
          genreId: 'g-id',
        },
        include: { author: true, publisher: true, genre: true },
      });
      expect(book).toMatchObject({
        id: 'b1',
        author: 'Gabriel García Márquez',
        price: 12990,
      });
    });

    it('does not create the book when a catalog step fails, so nothing is saved', async () => {
      resolve.mockImplementation((_tx: unknown, kind: string) =>
        kind === 'publisher'
          ? Promise.reject(new Error('db down'))
          : Promise.resolve(`${kind[0]}-id`),
      );

      await expect(service.create(input)).rejects.toThrow('db down');

      expect(tx.book.create).not.toHaveBeenCalled();
    });

    it('lets the failure of the book insert reach the transaction, which rolls back the catalogs', async () => {
      tx.book.create.mockRejectedValue(new Error('insert failed'));

      await expect(service.create(input)).rejects.toThrow('insert failed');
    });

    it('answers 409 when an active book with the same title, author and publisher exists', async () => {
      tx.book.create.mockRejectedValue(prismaError('P2002'));

      const attempt = service.create(input);

      await expect(attempt).rejects.toBeInstanceOf(ConflictException);
      await expect(attempt).rejects.toThrow(
        'A book with the same title, author and publisher already exists',
      );
    });
  });

  it('does not report a unique violation of a catalog as a duplicate book', async () => {
    const catalogRace = prismaError('P2002', 'Publisher');
    resolve.mockRejectedValue(catalogRace);

    await expect(service.create(input)).rejects.toBe(catalogRace);
    await expect(service.update('b1', { publisher: 'x' })).rejects.toBe(
      catalogRace,
    );
  });

  describe('findOne', () => {
    it('returns the book as the API shape', async () => {
      const book = await service.findOne('b1');

      expect(findUnique).toHaveBeenCalledWith({
        where: { id: 'b1' },
        include: { author: true, publisher: true, genre: true },
      });
      expect(book.title).toBe('Cien años de soledad');
      expect(book).not.toHaveProperty('deletedAt');
    });

    it('answers 404 when there is no active book with that id', async () => {
      findUnique.mockResolvedValue(null);

      const attempt = service.findOne('missing');

      await expect(attempt).rejects.toBeInstanceOf(NotFoundException);
      await expect(attempt).rejects.toThrow('Book not found');
    });
  });

  describe('update', () => {
    it('changes only the fields received and resolves only the catalogs received', async () => {
      await service.update('b1', { price: 15000, genre: 'Realismo mágico' });

      expect(resolve).toHaveBeenCalledTimes(1);
      expect(resolve).toHaveBeenCalledWith(tx, 'genre', 'Realismo mágico');
      expect(tx.book.update).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: {
          title: undefined,
          price: 15000,
          availability: undefined,
          authorId: undefined,
          publisherId: undefined,
          genreId: 'g-id',
        },
        include: { author: true, publisher: true, genre: true },
      });
    });

    it('resolves author and publisher too when they change', async () => {
      await service.update('b1', {
        author: 'Isabel Allende',
        publisher: 'Plaza',
      });

      expect(resolve).toHaveBeenCalledWith(tx, 'author', 'Isabel Allende');
      expect(resolve).toHaveBeenCalledWith(tx, 'publisher', 'Plaza');
      expect(resolve).not.toHaveBeenCalledWith(tx, 'genre', expect.anything());
      expect(tx.book.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            authorId: 'a-id',
            publisherId: 'p-id',
          }) as unknown,
        }),
      );
    });

    it('can set availability to false (a falsy value is still a change)', async () => {
      await service.update('b1', { availability: false });

      expect(tx.book.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ availability: false }) as unknown,
        }),
      );
      expect(resolve).not.toHaveBeenCalled();
    });

    it('returns the updated book', async () => {
      const book = await service.update('b1', { title: 'Otro' });

      expect(book.id).toBe('b1');
    });

    it.each([[{}], [{ title: undefined }]])(
      'rejects an empty change %j with 400 without opening a transaction',
      async (dto) => {
        await expect(service.update('b1', dto)).rejects.toBeInstanceOf(
          BadRequestException,
        );
        await expect(service.update('b1', dto)).rejects.toThrow(
          'At least one field is required',
        );
        expect($transaction).not.toHaveBeenCalled();
      },
    );

    it('answers 404 when the book does not exist or is deleted', async () => {
      tx.book.update.mockRejectedValue(prismaError('P2025'));

      const attempt = service.update('missing', { title: 'x' });

      await expect(attempt).rejects.toBeInstanceOf(NotFoundException);
      await expect(attempt).rejects.toThrow('Book not found');
    });

    it('answers 409 when the change would duplicate another active book', async () => {
      tx.book.update.mockRejectedValue(prismaError('P2002'));

      await expect(service.update('b1', { title: 'x' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('lets a catalog failure propagate without touching the book', async () => {
      resolve.mockRejectedValue(new Error('db down'));

      await expect(service.update('b1', { author: 'x' })).rejects.toThrow(
        'db down',
      );
      expect(tx.book.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('marks the book as deleted with the current date and does not delete the row', async () => {
      const before = Date.now();

      await expect(service.remove('b1')).resolves.toBeUndefined();

      expect(tx.book.update).toHaveBeenCalledTimes(1);
      const [args] = tx.book.update.mock.calls[0] as [
        { where: unknown; data: { deletedAt: Date } },
      ];
      expect(args.where).toEqual({ id: 'b1' });
      expect(args.data.deletedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(Object.keys(args.data)).toEqual(['deletedAt']);
    });

    it('never touches the catalogs (C5.4)', async () => {
      await service.remove('b1');

      expect(resolve).not.toHaveBeenCalled();
    });

    it('answers 404 when the book does not exist or was already deleted', async () => {
      tx.book.update.mockRejectedValue(prismaError('P2025'));

      await expect(service.remove('b1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('lets an unexpected failure propagate untouched', async () => {
      const failure = new Error('db down');
      tx.book.update.mockRejectedValue(failure);

      await expect(service.remove('b1')).rejects.toBe(failure);
    });
  });
});
