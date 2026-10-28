import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CatalogService } from '../catalog/catalog.service';
import { PrismaService } from '../prisma/prisma.service';
import { BOOK_INCLUDE, toBookDto } from './book.mapper';
import type { BookDto } from './dto/book.dto';
import type { CreateBookDto } from './dto/create-book.dto';
import type { UpdateBookDto } from './dto/update-book.dto';

const NOT_FOUND_MESSAGE = 'Book not found';
const DUPLICATE_MESSAGE =
  'A book with the same title, author and publisher already exists';
const EMPTY_UPDATE_MESSAGE = 'At least one field is required';

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
 * Every write runs in one transaction on `prisma.live` (which hides deleted
 * books): the catalog entries it creates and the book itself are saved together
 * or not at all (C2.5). `audit-log` will add its entry to the same transaction.
 */
@Injectable()
export class BooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  async create(dto: CreateBookDto): Promise<BookDto> {
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
        // audit-log adds here: await this.audit.log(tx, { action: 'CREATE', ... })
        return toBookDto(book);
      });
    } catch (error) {
      throw this.translate(error);
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

  async update(id: string, dto: UpdateBookDto): Promise<BookDto> {
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException(EMPTY_UPDATE_MESSAGE);
    }

    try {
      return await this.prisma.live.$transaction(async (tx) => {
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
        // audit-log adds here: await this.audit.log(tx, { action: 'UPDATE', ... })
        return toBookDto(book);
      });
    } catch (error) {
      throw this.translate(error);
    }
  }

  /** Soft delete: the row stays, marked with the date (C5.1). */
  async remove(id: string): Promise<void> {
    try {
      await this.prisma.live.$transaction(async (tx) => {
        await tx.book.update({
          where: { id },
          data: { deletedAt: new Date() },
        });
        // audit-log adds here: await this.audit.log(tx, { action: 'DELETE', ... })
      });
    } catch (error) {
      throw this.translate(error);
    }
  }

  /** The answers this service owns; anything else goes on to the global filter. */
  private translate(error: unknown): unknown {
    if (isKnownError(error, UNIQUE_VIOLATION)) {
      return new ConflictException(DUPLICATE_MESSAGE);
    }
    if (isKnownError(error, RECORD_NOT_FOUND)) {
      return new NotFoundException(NOT_FOUND_MESSAGE);
    }
    return error;
  }
}
