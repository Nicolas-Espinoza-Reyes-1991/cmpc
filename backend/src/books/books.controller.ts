import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { PaginatedResult } from '../common/types/api-response.types';
import { BooksService } from './books.service';
import { BookDto } from './dto/book.dto';
import { CreateBookDto } from './dto/create-book.dto';
import { ListBooksQueryDto } from './dto/list-books-query.dto';
import { PaginatedBooksDto } from './dto/paginated-books.dto';
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
