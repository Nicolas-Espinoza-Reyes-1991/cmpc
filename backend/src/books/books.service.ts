import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuditActor } from '../audit/audit.types';
import { CatalogService } from '../catalog/catalog.service';
import type { PaginatedResult } from '../common/types/api-response.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildBookOrderBy,
  buildBookWhere,
  sortCriteria,
} from './book-list.query';
import { BOOK_INCLUDE, toAuditSnapshot, toBookDto } from './book.mapper';
import { ImageStorage } from './images/image-storage';
import { sniffImageType } from './images/image-type';
import type { BookDto } from './dto/book.dto';
import { XLSX_MAX_ROWS } from './export/book-xlsx';
import type { CreateBookDto } from './dto/create-book.dto';
import type { ExportBooksQueryDto } from './dto/export-books-query.dto';
import type { ListBooksQueryDto } from './dto/list-books-query.dto';
import type { UpdateBookDto } from './dto/update-book.dto';
import type { UploadedImage } from './images/image-upload.config';

/** Books read from the database at a time while exporting. */
export const EXPORT_BATCH_SIZE = 500;

/** Name of the entity in the audit trail. */
const AUDIT_ENTITY = 'Book';

const NOT_FOUND_MESSAGE = 'Book not found';
const DUPLICATE_MESSAGE =
  'A book with the same title, author and publisher already exists';
const EMPTY_UPDATE_MESSAGE = 'At least one field is required';
const INVALID_IMAGE_MESSAGE =
  'The file is not a valid image: only JPEG, PNG and WebP are accepted';

const tooManyForExcel = (): UnprocessableEntityException =>
  new UnprocessableEntityException(
    `Too many books for Excel (maximum ${XLSX_MAX_ROWS}): narrow the filters or use the CSV export`,
  );

/** Prisma error codes this service turns into specific answers. */
const UNIQUE_VIOLATION = 'P2002';
const RECORD_NOT_FOUND = 'P2025';

function isKnownError(
  error: unknown,
  code: string,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}

/**
 * Only the unique index of books means "same title, author and publisher". A
 * unique violation raised by a catalog (same name created at once by another
 * request) must not be reported as a duplicate book.
 */
const isBookDuplicate = (error: unknown): boolean =>
  isKnownError(error, UNIQUE_VIOLATION) && error.meta?.modelName === 'Book';

/**
 * Every write runs in one transaction on `prisma.live` (which hides deleted
 * books): the catalog entries it creates and the book itself are saved together
 * or not at all (C2.5). The audit entry is written in the same transaction, so
 * an operation without its entry (or an entry without its operation) cannot
 * exist (G2.4).
 */
@Injectable()
export class BooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly storage: ImageStorage,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateBookDto, actor: AuditActor): Promise<BookDto> {
    try {
      return await this.prisma.live.$transaction(async (tx) => {
        const authorId = await this.catalog.resolve(tx, 'author', dto.author);
        const publisherId = await this.catalog.resolve(
          tx,
          'publisher',
          dto.publisher,
        );
        const genreId = await this.catalog.resolve(tx, 'genre', dto.genre);

        const book = await tx.book.create({
          data: {
            title: dto.title,
            price: dto.price,
            availability: dto.availability,
            authorId,
            publisherId,
            genreId,
          },
          include: BOOK_INCLUDE,
        });
        const created = toBookDto(book);
        await this.audit.log(tx, {
          action: 'CREATE',
          entity: AUDIT_ENTITY,
          entityId: created.id,
          after: toAuditSnapshot(created),
          actor,
        });
        return created;
      });
    } catch (error) {
      throw this.translate(error);
    }
  }

  /**
   * One page of the active books that match the filters. The count and the page
   * are read in one transaction so `total` belongs to the same snapshot as
   * `items`. The page is always at most `limit` books (L5.2).
   */
  async findAll(query: ListBooksQueryDto): Promise<PaginatedResult<BookDto>> {
    const where = buildBookWhere(query);
    const { page, limit } = query;

    const [total, books] = await this.prisma.live.$transaction([
      this.prisma.live.book.count({ where }),
      this.prisma.live.book.findMany({
        where,
        orderBy: buildBookOrderBy(sortCriteria(query.sort)),
        skip: (page - 1) * limit,
        take: limit,
        include: BOOK_INCLUDE,
      }),
    ]);

    return { items: books.map(toBookDto), meta: { page, limit, total } };
  }

  /**
   * Every active book that matches the filters, in the order of the listing,
   * as batches. A generator: the next batch is not read until the consumer asks
   * for it (backpressure), and stopping the consumer stops the reading, so the
   * memory used is one batch and not the whole table.
   *
   * Each batch continues after the last book of the previous one with Prisma's
   * `cursor`, which is exact because the order ends in the unique `id` (an
   * offset would make the database walk and discard all the earlier rows on
   * every batch). A deleted book is only marked, so the cursor row always exists.
   */
  async *exportRows(
    query: ExportBooksQueryDto,
  ): AsyncGenerator<BookDto[], void, undefined> {
    const where = buildBookWhere(query);
    const orderBy = buildBookOrderBy(sortCriteria(query.sort));
    let cursor: string | undefined;

    for (;;) {
      const batch = await this.prisma.live.book.findMany({
        where,
        orderBy,
        take: EXPORT_BATCH_SIZE,
        include: BOOK_INCLUDE,
        ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
      });
      if (batch.length > 0) yield batch.map(toBookDto);
      // A short batch is the last one; a full one may be followed by more.
      if (batch.length < EXPORT_BATCH_SIZE) return;
      cursor = batch[batch.length - 1]?.id;
    }
  }

  async findOne(id: string): Promise<BookDto> {
    const book = await this.prisma.live.book.findUnique({
      where: { id },
      include: BOOK_INCLUDE,
    });
    if (!book) throw new NotFoundException(NOT_FOUND_MESSAGE);
    return toBookDto(book);
  }

  async update(
    id: string,
    dto: UpdateBookDto,
    actor: AuditActor,
  ): Promise<BookDto> {
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException(EMPTY_UPDATE_MESSAGE);
    }

    try {
      return await this.prisma.live.$transaction(async (tx) => {
        const before = await this.readForAudit(tx, id);
        // Only the catalogs that came in the body are resolved (and created).
        const authorId =
          dto.author === undefined
            ? undefined
            : await this.catalog.resolve(tx, 'author', dto.author);
        const publisherId =
          dto.publisher === undefined
            ? undefined
            : await this.catalog.resolve(tx, 'publisher', dto.publisher);
        const genreId =
          dto.genre === undefined
            ? undefined
            : await this.catalog.resolve(tx, 'genre', dto.genre);

        // Prisma leaves out the fields that are `undefined`: a partial update.
        // A deleted or missing book makes this throw P2025 (see `translate`).
        const book = await tx.book.update({
          where: { id },
          data: {
            title: dto.title,
            price: dto.price,
            availability: dto.availability,
            authorId,
            publisherId,
            genreId,
          },
          include: BOOK_INCLUDE,
        });
        const updated = toBookDto(book);
        await this.audit.log(tx, {
          action: 'UPDATE',
          entity: AUDIT_ENTITY,
          entityId: id,
          before: toAuditSnapshot(before),
          after: toAuditSnapshot(updated),
          actor,
        });
        return updated;
      });
    } catch (error) {
      throw this.translate(error);
    }
  }

  /**
   * Every active book that matches the filters, in the order of the listing, for
   * a file that is built in memory (the Excel). It refuses more than
   * `XLSX_MAX_ROWS` (422): first by counting, so nothing is read for a request
   * that is too big, and again while reading, because books can be added
   * between the count and the last batch and the limit must hold anyway.
   */
  async exportAll(query: ExportBooksQueryDto): Promise<BookDto[]> {
    const total = await this.prisma.live.book.count({
      where: buildBookWhere(query),
    });
    if (total > XLSX_MAX_ROWS) throw tooManyForExcel();

    const books: BookDto[] = [];
    for await (const batch of this.exportRows(query)) {
      books.push(...batch);
      if (books.length > XLSX_MAX_ROWS) throw tooManyForExcel();
    }
    return books;
  }

  /** Soft delete: the row stays, marked with the date (C5.1). */
  async remove(id: string, actor: AuditActor): Promise<void> {
    try {
      await this.prisma.live.$transaction(async (tx) => {
        const before = await this.readForAudit(tx, id);
        await tx.book.update({
          where: { id },
          data: { deletedAt: new Date() },
        });
        await this.audit.log(tx, {
          action: 'DELETE',
          entity: AUDIT_ENTITY,
          entityId: id,
          before: toAuditSnapshot(before),
          actor,
        });
      });
    } catch (error) {
      throw this.translate(error);
    }
  }

  /**
   * Sets the cover of a book. The type is decided by the bytes of the file, the
   * book must exist before anything is written, and the order is: write the new
   * file, update the book, delete the old file. If the update fails the new file
   * is removed; if deleting the old one fails only an unreferenced file is left.
   * The opposite order could leave a book pointing at a file that is not there.
   */
  async setImage(
    id: string,
    image: UploadedImage,
    actor: AuditActor,
  ): Promise<BookDto> {
    const type = sniffImageType(image.buffer);
    if (!type) throw new BadRequestException(INVALID_IMAGE_MESSAGE);

    const current = await this.prisma.live.book.findUnique({
      where: { id },
      select: { imageUrl: true },
    });
    if (!current) throw new NotFoundException(NOT_FOUND_MESSAGE);

    const name = await this.storage.save(image.buffer, type.extension);
    let book: BookDto;
    try {
      book = await this.updateImageUrl(id, this.storage.urlFor(name), actor);
    } catch (error) {
      await this.storage.remove(name);
      throw this.translate(error);
    }
    // Outside the `try`: the book already points at the new file.
    await this.removeStored(current.imageUrl);
    return book;
  }

  /** Removes the cover. A book without one is returned as it is (idempotent). */
  async removeImage(id: string, actor: AuditActor): Promise<BookDto> {
    const current = await this.prisma.live.book.findUnique({
      where: { id },
      include: BOOK_INCLUDE,
    });
    if (!current) throw new NotFoundException(NOT_FOUND_MESSAGE);
    if (!current.imageUrl) return toBookDto(current);

    let book: BookDto;
    try {
      book = await this.updateImageUrl(id, null, actor);
    } catch (error) {
      throw this.translate(error);
    }
    await this.removeStored(current.imageUrl);
    return book;
  }

  private async updateImageUrl(
    id: string,
    imageUrl: string | null,
    actor: AuditActor,
  ): Promise<BookDto> {
    return this.prisma.live.$transaction(async (tx) => {
      const before = await this.readForAudit(tx, id);
      const book = await tx.book.update({
        where: { id },
        data: { imageUrl },
        include: BOOK_INCLUDE,
      });
      const updated = toBookDto(book);
      await this.audit.log(tx, {
        action: 'UPDATE',
        entity: AUDIT_ENTITY,
        entityId: id,
        before: toAuditSnapshot(before),
        after: toAuditSnapshot(updated),
        actor,
      });
      return updated;
    });
  }

  /**
   * The book as it is right now, read inside the transaction that is about to
   * change it, so the `before` of the audit entry is exactly what gets
   * overwritten. The row is locked first: two edits of the same book queue here
   * instead of both reading the same state, which would leave a `before` that
   * is not the `after` of the previous entry (found verifying against
   * PostgreSQL). A missing or deleted book ends the transaction with a 404.
   */
  private async readForAudit(
    tx: Pick<PrismaService['live'], 'book' | '$queryRaw'>,
    id: string,
  ): Promise<BookDto> {
    await tx.$queryRaw`SELECT 1 FROM books WHERE id = ${id}::uuid FOR UPDATE`;
    const book = await tx.book.findUnique({
      where: { id },
      include: BOOK_INCLUDE,
    });
    if (!book) throw new NotFoundException(NOT_FOUND_MESSAGE);
    return toBookDto(book);
  }

  /** Deletes the file behind an `imageUrl`, if it is one of ours. */
  private async removeStored(imageUrl: string | null): Promise<void> {
    const name = this.storage.nameFromUrl(imageUrl);
    if (name) await this.storage.remove(name);
  }

  /** The answers this service owns; anything else goes on to the global filter. */
  private translate(error: unknown): unknown {
    if (isBookDuplicate(error)) {
      return new ConflictException(DUPLICATE_MESSAGE);
    }
    if (isKnownError(error, RECORD_NOT_FOUND)) {
      return new NotFoundException(NOT_FOUND_MESSAGE);
    }
    return error;
  }
}
