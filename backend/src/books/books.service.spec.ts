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
import { BooksService, EXPORT_BATCH_SIZE } from './books.service';
import type { CreateBookDto } from './dto/create-book.dto';
import { ExportBooksQueryDto } from './dto/export-books-query.dto';
import { ListBooksQueryDto } from './dto/list-books-query.dto';
import { ImageStorage } from './images/image-storage';

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

const NEW_NAME = '3f6c2a52-7f0e-4c3e-9d57-1d8f0f6a9b11.png';
const OLD_NAME = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d.jpg';
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32),
]);

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
  // Typed by its argument so the tests can read what each call asked the database for.
  const findMany = jest.fn<Promise<unknown>, [Record<string, unknown>]>();
  const $transaction = jest.fn();
  const resolve = jest.fn();
  const storage = {
    save: jest.fn(),
    remove: jest.fn(),
    urlFor: jest.fn(),
    nameFromUrl: jest.fn(),
  };
  let service: BooksService;

  beforeEach(async () => {
    tx.book.create.mockReset().mockResolvedValue(row);
    tx.book.update.mockReset().mockResolvedValue(row);
    findUnique.mockReset().mockResolvedValue(row);
    storage.save.mockReset().mockResolvedValue(NEW_NAME);
    storage.remove.mockReset().mockResolvedValue(undefined);
    storage.urlFor
      .mockReset()
      .mockImplementation((name: string) => `/api/uploads/${name}`);
    storage.nameFromUrl
      .mockReset()
      .mockImplementation((url: string | null) =>
        url ? url.replace('/api/uploads/', '') : null,
      );
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
        { provide: ImageStorage, useValue: storage },
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

  describe('setImage', () => {
    const withImage = (imageUrl: string | null) => ({ ...row, imageUrl });
    beforeEach(() => {
      findUnique.mockResolvedValue({ imageUrl: null });
      tx.book.update.mockResolvedValue(withImage(`/api/uploads/${NEW_NAME}`));
    });

    it('stores the file, points the book at it and returns the book', async () => {
      const book = await service.setImage('b1', { buffer: PNG });

      expect(storage.save).toHaveBeenCalledWith(PNG, 'png');
      expect(tx.book.update).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: { imageUrl: `/api/uploads/${NEW_NAME}` },
        include: { author: true, publisher: true, genre: true },
      });
      expect(book.imageUrl).toBe(`/api/uploads/${NEW_NAME}`);
    });

    it.each([
      ['jpg', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])],
      [
        'webp',
        Buffer.concat([
          Buffer.from('RIFF'),
          Buffer.alloc(4),
          Buffer.from('WEBP'),
          Buffer.alloc(8),
        ]),
      ],
    ])('stores a %s with its own extension', async (extension, buffer) => {
      await service.setImage('b1', { buffer });

      expect(storage.save).toHaveBeenCalledWith(buffer, extension);
    });

    it('deletes the previous file after the book points at the new one', async () => {
      findUnique.mockResolvedValue({ imageUrl: `/api/uploads/${OLD_NAME}` });

      await service.setImage('b1', { buffer: PNG });

      expect(storage.remove).toHaveBeenCalledTimes(1);
      expect(storage.remove).toHaveBeenCalledWith(OLD_NAME);
      const updated = tx.book.update.mock.invocationCallOrder[0] as number;
      const removed = storage.remove.mock.invocationCallOrder[0] as number;
      expect(removed).toBeGreaterThan(updated);
    });

    it('deletes nothing when the book had no image', async () => {
      await service.setImage('b1', { buffer: PNG });

      expect(storage.remove).not.toHaveBeenCalled();
    });

    it('does not delete a previous URL that is not one of ours', async () => {
      findUnique.mockResolvedValue({
        imageUrl: 'https://elsewhere.test/x.png',
      });
      storage.nameFromUrl.mockReturnValue(null);

      await service.setImage('b1', { buffer: PNG });

      expect(storage.remove).not.toHaveBeenCalled();
    });

    it.each([
      ['text', Buffer.from('just text, not an image')],
      ['HTML', Buffer.from('<html><script>alert(1)</script></html>')],
      ['an empty file', Buffer.alloc(0)],
    ])(
      'rejects %s with 400 before looking for the book or writing anything',
      async (_label, buffer) => {
        const attempt = service.setImage('b1', { buffer });

        await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
        await expect(attempt).rejects.toThrow('not a valid image');
        expect(findUnique).not.toHaveBeenCalled();
        expect(storage.save).not.toHaveBeenCalled();
      },
    );

    it('answers 404 without writing a file when the book does not exist', async () => {
      findUnique.mockResolvedValue(null);

      await expect(
        service.setImage('missing', { buffer: PNG }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(storage.save).not.toHaveBeenCalled();
    });

    it('removes the new file when updating the book fails, so nothing is left behind', async () => {
      tx.book.update.mockRejectedValue(new Error('db down'));

      await expect(service.setImage('b1', { buffer: PNG })).rejects.toThrow(
        'db down',
      );

      expect(storage.remove).toHaveBeenCalledWith(NEW_NAME);
    });

    it('keeps the previous file when updating the book fails', async () => {
      findUnique.mockResolvedValue({ imageUrl: `/api/uploads/${OLD_NAME}` });
      tx.book.update.mockRejectedValue(new Error('db down'));

      await expect(service.setImage('b1', { buffer: PNG })).rejects.toThrow();

      expect(storage.remove).toHaveBeenCalledTimes(1);
      expect(storage.remove).not.toHaveBeenCalledWith(OLD_NAME);
    });

    it('answers 404 and cleans up when the book was deleted while the file was written', async () => {
      tx.book.update.mockRejectedValue(prismaError('P2025'));

      await expect(
        service.setImage('b1', { buffer: PNG }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(storage.remove).toHaveBeenCalledWith(NEW_NAME);
    });

    it('does not remove the new file when the old one is cleaned up', async () => {
      findUnique.mockResolvedValue({ imageUrl: `/api/uploads/${OLD_NAME}` });

      const book = await service.setImage('b1', { buffer: PNG });

      expect(book.imageUrl).toBe(`/api/uploads/${NEW_NAME}`);
      expect(storage.remove).not.toHaveBeenCalledWith(NEW_NAME);
    });

    it('lets a failure to write the file propagate without touching the book', async () => {
      storage.save.mockRejectedValue(new Error('disk full'));

      await expect(service.setImage('b1', { buffer: PNG })).rejects.toThrow(
        'disk full',
      );

      expect(tx.book.update).not.toHaveBeenCalled();
    });
  });

  describe('removeImage', () => {
    const withImage = { ...row, imageUrl: `/api/uploads/${OLD_NAME}` };

    it('clears the image of the book and deletes the file', async () => {
      findUnique.mockResolvedValue(withImage);
      tx.book.update.mockResolvedValue({ ...row, imageUrl: null });

      const book = await service.removeImage('b1');

      expect(tx.book.update).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: { imageUrl: null },
        include: { author: true, publisher: true, genre: true },
      });
      expect(storage.remove).toHaveBeenCalledWith(OLD_NAME);
      expect(book.imageUrl).toBeNull();
    });

    it('returns a book without an image as it is, touching nothing (idempotent)', async () => {
      findUnique.mockResolvedValue({ ...row, imageUrl: null });

      const book = await service.removeImage('b1');

      expect(book.id).toBe('b1');
      expect($transaction).not.toHaveBeenCalled();
      expect(storage.remove).not.toHaveBeenCalled();
    });

    it('answers 404 when the book does not exist', async () => {
      findUnique.mockResolvedValue(null);

      await expect(service.removeImage('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('keeps the file when updating the book fails', async () => {
      findUnique.mockResolvedValue(withImage);
      tx.book.update.mockRejectedValue(new Error('db down'));

      await expect(service.removeImage('b1')).rejects.toThrow('db down');

      expect(storage.remove).not.toHaveBeenCalled();
    });

    it('answers 404 when the book was deleted in between', async () => {
      findUnique.mockResolvedValue(withImage);
      tx.book.update.mockRejectedValue(prismaError('P2025'));

      await expect(service.removeImage('b1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
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

  describe('exportRows', () => {
    const query = (overrides: Partial<ExportBooksQueryDto> = {}) =>
      Object.assign(new ExportBooksQueryDto(), overrides);
    const rows = (from: number, count: number) =>
      Array.from({ length: count }, (_, i) => ({ ...row, id: `b${from + i}` }));
    const collect = async (source: AsyncGenerator<unknown[]>) => {
      const batches: unknown[][] = [];
      for await (const batch of source) batches.push(batch);
      return batches;
    };

    it('gives one short batch as the only batch, without a cursor', async () => {
      findMany.mockResolvedValue(rows(1, 3));

      const batches = await collect(service.exportRows(query()));

      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(3);
      expect(findMany).toHaveBeenCalledTimes(1);
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: EXPORT_BATCH_SIZE }),
      );
      expect(findMany.mock.calls[0]?.[0]).not.toHaveProperty('cursor');
      expect(findMany.mock.calls[0]?.[0]).not.toHaveProperty('skip');
    });

    it('continues after the last book of each full batch with the cursor', async () => {
      findMany
        .mockResolvedValueOnce(rows(0, EXPORT_BATCH_SIZE))
        .mockResolvedValueOnce(rows(EXPORT_BATCH_SIZE, EXPORT_BATCH_SIZE))
        .mockResolvedValueOnce(rows(2 * EXPORT_BATCH_SIZE, 120));

      const batches = await collect(service.exportRows(query()));

      expect(batches.map((batch) => batch.length)).toEqual([500, 500, 120]);
      expect(findMany).toHaveBeenCalledTimes(3);
      expect(findMany.mock.calls[1]?.[0]).toMatchObject({
        cursor: { id: 'b499' },
        skip: 1,
        take: EXPORT_BATCH_SIZE,
      });
      expect(findMany.mock.calls[2]?.[0]).toMatchObject({
        cursor: { id: 'b999' },
        skip: 1,
      });
    });

    it('does not repeat the cursor book: skip 1 leaves it out', async () => {
      findMany
        .mockResolvedValueOnce(rows(0, EXPORT_BATCH_SIZE))
        .mockResolvedValueOnce([]);

      await collect(service.exportRows(query()));

      expect(findMany.mock.calls[1]?.[0]).toMatchObject({ skip: 1 });
    });

    it('ends after a batch of exactly 500 followed by an empty one, without an empty batch', async () => {
      findMany
        .mockResolvedValueOnce(rows(0, EXPORT_BATCH_SIZE))
        .mockResolvedValueOnce([]);

      const batches = await collect(service.exportRows(query()));

      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(EXPORT_BATCH_SIZE);
      expect(findMany).toHaveBeenCalledTimes(2);
    });

    it('gives nothing when no book matches', async () => {
      findMany.mockResolvedValue([]);

      await expect(collect(service.exportRows(query()))).resolves.toEqual([]);
      expect(findMany).toHaveBeenCalledTimes(1);
    });

    it('filters and orders exactly like the listing, ending with id', async () => {
      findMany.mockResolvedValue([]);

      await collect(
        service.exportRows(
          query({
            search: 'dune',
            author: 'herb',
            availability: false,
            sort: 'genre:asc,price:desc',
          }),
        ),
      );

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { title: { contains: 'dune', mode: 'insensitive' } },
              { author: { name: { contains: 'herb', mode: 'insensitive' } } },
              { availability: false },
            ],
          },
          orderBy: [
            { genre: { name: 'asc' } },
            { price: 'desc' },
            { id: 'asc' },
          ],
        }),
      );
    });

    it('shows the newest book first when there is no sort', async () => {
      findMany.mockResolvedValue([]);

      await collect(service.exportRows(query()));

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        }),
      );
    });

    it('keeps the same filters and order in every batch', async () => {
      findMany
        .mockResolvedValueOnce(rows(0, EXPORT_BATCH_SIZE))
        .mockResolvedValueOnce(rows(EXPORT_BATCH_SIZE, 1));

      await collect(
        service.exportRows(query({ search: 'dune', sort: 'price:asc' })),
      );

      const [first, second] = findMany.mock.calls.map(
        (call) =>
          call[0] as {
            where: unknown;
            orderBy: unknown;
          },
      );
      expect(second?.where).toEqual(first?.where);
      expect(second?.orderBy).toEqual(first?.orderBy);
    });

    it('maps every book to the API shape, without the internal fields', async () => {
      findMany.mockResolvedValue(rows(1, 2));

      const [batch] = await collect(service.exportRows(query()));

      expect(batch?.[0]).toMatchObject({
        id: 'b1',
        author: 'Gabriel García Márquez',
        price: 12990,
      });
      expect(batch?.[0]).not.toHaveProperty('deletedAt');
      expect(batch?.[0]).not.toHaveProperty('authorId');
    });

    it('does not read ahead: nothing is read until the consumer asks', async () => {
      findMany.mockResolvedValue(rows(0, EXPORT_BATCH_SIZE));
      const source = service.exportRows(query());

      expect(findMany).not.toHaveBeenCalled();
      await source.next();
      expect(findMany).toHaveBeenCalledTimes(1);

      await source.return();
    });

    it('stops reading when the consumer stops (a client that disconnects)', async () => {
      findMany.mockResolvedValue(rows(0, EXPORT_BATCH_SIZE));

      for await (const batch of service.exportRows(query())) {
        expect(batch).toHaveLength(EXPORT_BATCH_SIZE);
        break;
      }

      expect(findMany).toHaveBeenCalledTimes(1);
    });

    it('lets a database failure in a later batch reach the consumer', async () => {
      findMany
        .mockResolvedValueOnce(rows(0, EXPORT_BATCH_SIZE))
        .mockRejectedValueOnce(new Error('db down'));
      const received: number[] = [];

      const consume = async () => {
        for await (const batch of service.exportRows(query())) {
          received.push(batch.length);
        }
      };

      await expect(consume()).rejects.toThrow('db down');
      expect(received).toEqual([EXPORT_BATCH_SIZE]);
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
