import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  BadRequestException,
  ParseUUIDPipe,
  Patch,
  Post,
  Logger,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { pipeline } from 'node:stream/promises';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuditActor } from '../audit/audit.types';
import { Actor } from '../common/decorators/actor.decorator';
import { ApiDataResponse } from '../common/swagger/api-data-response.decorator';
import { RawResponse } from '../common/decorators/raw-response.decorator';
import type { PaginatedResult } from '../common/types/api-response.types';
import { BooksService } from './books.service';
import { csvFileName } from './export/book-csv';
import {
  bookCsvRows,
  createBomWriter,
  createCsvFormatter,
} from './export/book-csv-stream';
import { BookDto } from './dto/book.dto';
import { CreateBookDto } from './dto/create-book.dto';
import { ExportBooksQueryDto } from './dto/export-books-query.dto';
import { ListBooksQueryDto } from './dto/list-books-query.dto';
import { PaginatedBooksDto } from './dto/paginated-books.dto';
import {
  IMAGE_FIELD,
  IMAGE_UPLOAD_LIMITS,
  MAX_IMAGE_BYTES,
  type UploadedImage,
} from './images/image-upload.config';
import { UpdateBookDto } from './dto/update-book.dto';

/**
 * Nothing here is `@Public()`, so the global guard asks for a token (C7.1).
 */
@ApiTags('books')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing, invalid or expired token.' })
@Controller('books')
export class BooksController {
  private readonly logger = new Logger(BooksController.name);

  constructor(private readonly books: BooksService) {}

  @Post()
  @ApiOperation({
    summary: 'Register a book',
    description:
      'Author, publisher and genre are given by name and created when they do not exist.',
  })
  @ApiDataResponse(BookDto, {
    description: 'The registered book, in `data`.',
    status: HttpStatus.CREATED,
  })
  @ApiBadRequestResponse({ description: 'Invalid body (errors per field).' })
  @ApiConflictResponse({
    description:
      'An active book with the same title, author and publisher already exists.',
  })
  create(
    @Body() dto: CreateBookDto,
    @Actor() actor: AuditActor,
  ): Promise<BookDto> {
    return this.books.create(dto, actor);
  }

  @Get()
  @ApiOperation({
    summary: 'List books',
    description:
      'Filtered, ordered and paginated on the server. The answer is `{ data, meta: { page, limit, total } }`.',
  })
  @ApiOkResponse({
    type: PaginatedBooksDto,
    description: 'One page of books in `data` and the totals in `meta`.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid query parameters (errors per field).',
  })
  list(@Query() query: ListBooksQueryDto): Promise<PaginatedResult<BookDto>> {
    return this.books.findAll(query);
  }

  /**
   * Declared before `GET :id`, or `export` would be read as a book id.
   *
   * The file is streamed: the books are read in batches and written as they
   * arrive, so memory does not grow with the number of books. The first batch
   * is read before any header is sent, so a database failure at the start is a
   * normal error response. A failure later, or the client closing the
   * connection, aborts the transfer (`pipeline` closes every stage, which also
   * stops reading the database).
   */
  @Get('export')
  @RawResponse()
  @ApiOperation({
    summary: 'Export books to CSV',
    description:
      'Every active book that matches the filters, in the order of the listing, as a CSV file (RFC 4180, UTF-8 with a byte order mark, comma separated, Spanish headers). It accepts the filters and `sort` of the listing and no pagination. Text that a spreadsheet could read as a formula is prefixed with a quote.',
  })
  @ApiProduces('text/csv')
  @ApiOkResponse({
    description: 'The CSV file, sent as an attachment.',
    content: { 'text/csv': { schema: { type: 'string' } } },
  })
  @ApiBadRequestResponse({
    description:
      'Invalid filters or order, or `page` / `limit`, which the export does not take.',
  })
  async exportCsv(
    @Query() query: ExportBooksQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const batches = this.books.exportRows(query);
    const first = await batches.next();

    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${csvFileName(new Date())}"`,
      // An inventory report should not be kept by a shared cache.
      'Cache-Control': 'no-store',
    });

    try {
      await pipeline(
        bookCsvRows(first, batches),
        createCsvFormatter(),
        createBomWriter(),
        res,
      );
    } catch (error) {
      // Headers are already sent: the transfer was aborted (the client left, or
      // the database failed halfway). Nothing internal goes to the client.
      this.logger.warn(`CSV export aborted: ${String(error)}`);
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one book' })
  @ApiDataResponse(BookDto, { description: 'The book, in `data`.' })
  @ApiBadRequestResponse({ description: '`id` is not a UUID.' })
  @ApiNotFoundResponse({ description: 'No active book with that id.' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<BookDto> {
    return this.books.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Change some fields of a book',
    description: 'Send only the fields to change; at least one is required.',
  })
  @ApiDataResponse(BookDto, { description: 'The book, in `data`.' })
  @ApiBadRequestResponse({
    description: 'Invalid or empty body, or `id` is not a UUID.',
  })
  @ApiNotFoundResponse({ description: 'No active book with that id.' })
  @ApiConflictResponse({
    description: 'The change would duplicate another active book.',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBookDto,
    @Actor() actor: AuditActor,
  ): Promise<BookDto> {
    return this.books.update(id, dto, actor);
  }

  @Post(':id/image')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor(IMAGE_FIELD, { limits: IMAGE_UPLOAD_LIMITS }),
  )
  @ApiOperation({
    summary: 'Set the cover image of a book',
    description: `Send the file as \`multipart/form-data\` in the field \`${IMAGE_FIELD}\`. Only JPEG, PNG and WebP are accepted, decided by the content of the file, up to ${MAX_IMAGE_BYTES / 1024 / 1024} MB. It replaces the current cover, if any.`,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: [IMAGE_FIELD],
      properties: { [IMAGE_FIELD]: { type: 'string', format: 'binary' } },
    },
  })
  @ApiDataResponse(BookDto, { description: 'The book, in `data`.' })
  @ApiBadRequestResponse({
    description:
      'No file, more than one, another field, or the content is not a JPEG, PNG or WebP image; or `id` is not a UUID.',
  })
  @ApiPayloadTooLargeResponse({ description: 'The file is larger than 2 MB.' })
  @ApiNotFoundResponse({ description: 'No active book with that id.' })
  uploadImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedImage | undefined,
    @Actor() actor: AuditActor,
  ): Promise<BookDto> {
    if (!file) {
      throw new BadRequestException(
        `An image file is required in the field "${IMAGE_FIELD}"`,
      );
    }
    return this.books.setImage(id, file, actor);
  }

  @Delete(':id/image')
  @ApiOperation({
    summary: 'Remove the cover image of a book',
    description: 'A book without a cover is returned unchanged.',
  })
  @ApiDataResponse(BookDto, { description: 'The book, in `data`.' })
  @ApiBadRequestResponse({ description: '`id` is not a UUID.' })
  @ApiNotFoundResponse({ description: 'No active book with that id.' })
  removeImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Actor() actor: AuditActor,
  ): Promise<BookDto> {
    return this.books.removeImage(id, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a book',
    description:
      'Soft delete: the book stops appearing everywhere but its row is kept.',
  })
  @ApiNoContentResponse({ description: 'Deleted.' })
  @ApiBadRequestResponse({ description: '`id` is not a UUID.' })
  @ApiNotFoundResponse({
    description: 'No active book with that id (or already deleted).',
  })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Actor() actor: AuditActor,
  ): Promise<void> {
    return this.books.remove(id, actor);
  }
}
