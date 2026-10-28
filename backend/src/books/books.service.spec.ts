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
import { ListBooksQueryDto } from './dto/list-books-query.dto';

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
  const count = jest.fn();
  const findMany = jest.fn();
  const $transaction = jest.fn();
  const resolve = jest.fn();
  let service: BooksService;

  beforeEach(async () => {
    tx.book.create.mockReset().mockResolvedValue(row);
    tx.book.update.mockReset().mockResolvedValue(row);
    findUnique.mockReset().mockResolvedValue(row);
    count.mockReset().mockResolvedValue(1);
    findMany.mockReset().mockResolvedValue([row]);
    // A callback receives the transaction client; a list of queries is run together.
    $transaction
      .mockReset()
      .mockImplementation(
        (
          work: ((client: typeof tx) => Promise<unknown>) | Promise<unknown>[],
        ) => (Array.isArray(work) ? Promise.all(work) : work(tx)),
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
          useValue: {
            live: { $transaction, book: { findUnique, count, findMany } },
          },
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

  describe('findAll', () => {
    const query = (overrides: Partial<ListBooksQueryDto> = {}) =>
      Object.assign(new ListBooksQueryDto(), overrides);

    it('returns the page as items and meta, mapped to the API shape', async () => {
      count.mockResolvedValue(42);

      const result = await service.findAll(query({ page: 2, limit: 10 }));

      expect(result.meta).toEqual({ page: 2, limit: 10, total: 42 });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        id: 'b1',
        author: 'Gabriel García Márquez',
        price: 12990,
      });
      expect(result.items[0]).not.toHaveProperty('deletedAt');
    });

    it('reads the count and the page in one transaction', async () => {
      await service.findAll(query());

      expect($transaction).toHaveBeenCalledTimes(1);
      expect(count).toHaveBeenCalledTimes(1);
      expect(findMany).toHaveBeenCalledTimes(1);
    });

    it.each([
      [1, 10, 0],
      [2, 10, 10],
      [3, 25, 50],
      [1, 100, 0],
    ])('page %s of %s books skips %s', async (page, limit, skip) => {
      await service.findAll(query({ page, limit }));

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip, take: limit }),
      );
    });

    it('counts and reads with the same filters', async () => {
      await service.findAll(
        query({ search: 'dune', availability: true, author: 'herb' }),
      );

      const where = {
        AND: [
          { title: { contains: 'dune', mode: 'insensitive' } },
          { author: { name: { contains: 'herb', mode: 'insensitive' } } },
          { availability: true },
        ],
      };
      expect(count).toHaveBeenCalledWith({ where });
      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
    });

    it('orders by the newest first, then id, when there is no sort', async () => {
      await service.findAll(query());

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        }),
      );
    });

    it('orders by the criteria of sort, in priority order, ending with id', async () => {
      await service.findAll(query({ sort: 'genre:asc,price:desc' }));

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [
            { genre: { name: 'asc' } },
            { price: 'desc' },
            { id: 'asc' },
          ],
        }),
      );
    });

    it('includes the catalogs the mapper needs', async () => {
      await service.findAll(query());

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { author: true, publisher: true, genre: true },
        }),
      );
    });

    it('answers an empty page, not an error, beyond the last page', async () => {
      count.mockResolvedValue(3);
      findMany.mockResolvedValue([]);

      await expect(service.findAll(query({ page: 99 }))).resolves.toEqual({
        items: [],
        meta: { page: 99, limit: 10, total: 3 },
      });
    });

    it('lets a database failure propagate', async () => {
      findMany.mockRejectedValue(new Error('db down'));

      await expect(service.findAll(query())).rejects.toThrow('db down');
    });
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
