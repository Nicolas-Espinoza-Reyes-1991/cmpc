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
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { PaginatedResult } from '../common/types/api-response.types';
import { BooksService } from './books.service';
import { BookDto } from './dto/book.dto';
import { CreateBookDto } from './dto/create-book.dto';
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
  constructor(private readonly books: BooksService) {}

  @Post()
  @ApiOperation({
    summary: 'Register a book',
    description:
      'Author, publisher and genre are given by name and created when they do not exist.',
  })
  @ApiCreatedResponse({ type: BookDto })
  @ApiBadRequestResponse({ description: 'Invalid body (errors per field).' })
  @ApiConflictResponse({
    description:
      'An active book with the same title, author and publisher already exists.',
  })
  create(@Body() dto: CreateBookDto): Promise<BookDto> {
    return this.books.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List books',
    description:
      'Filtered, ordered and paginated on the server. The answer is `{ data, meta: { page, limit, total } }`.',
  })
  @ApiOkResponse({ type: PaginatedBooksDto })
  @ApiBadRequestResponse({
    description: 'Invalid query parameters (errors per field).',
  })
  list(@Query() query: ListBooksQueryDto): Promise<PaginatedResult<BookDto>> {
    return this.books.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one book' })
  @ApiOkResponse({ type: BookDto })
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
  @ApiOkResponse({ type: BookDto })
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
  ): Promise<BookDto> {
    return this.books.update(id, dto);
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
  @ApiOkResponse({ type: BookDto })
  @ApiBadRequestResponse({
    description:
      'No file, more than one, another field, or the content is not a JPEG, PNG or WebP image; or `id` is not a UUID.',
  })
  @ApiPayloadTooLargeResponse({ description: 'The file is larger than 2 MB.' })
  @ApiNotFoundResponse({ description: 'No active book with that id.' })
  uploadImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedImage | undefined,
  ): Promise<BookDto> {
    if (!file) {
      throw new BadRequestException(
        `An image file is required in the field "${IMAGE_FIELD}"`,
      );
    }
    return this.books.setImage(id, file);
  }

  @Delete(':id/image')
  @ApiOperation({
    summary: 'Remove the cover image of a book',
    description: 'A book without a cover is returned unchanged.',
  })
  @ApiOkResponse({ type: BookDto })
  @ApiBadRequestResponse({ description: '`id` is not a UUID.' })
  @ApiNotFoundResponse({ description: 'No active book with that id.' })
  removeImage(@Param('id', ParseUUIDPipe) id: string): Promise<BookDto> {
    return this.books.removeImage(id);
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
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.books.remove(id);
  }
}
