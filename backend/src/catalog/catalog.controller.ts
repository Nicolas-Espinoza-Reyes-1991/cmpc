import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { CatalogItemDto } from './dto/catalog-item.dto';
import { CatalogQueryDto } from './dto/catalog-query.dto';

/**
 * Read-only on purpose (C6.3): entries are created when a book is saved. They
 * feed the form suggestions and, later, the listing filters.
 */
@ApiTags('catalog')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing, invalid or expired token.' })
@ApiBadRequestResponse({ description: 'Invalid `search` or `limit`.' })
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('authors')
  @ApiOperation({ summary: 'List authors by name' })
  @ApiOkResponse({ type: CatalogItemDto, isArray: true })
  authors(@Query() query: CatalogQueryDto): Promise<CatalogItemDto[]> {
    return this.catalog.list('author', query);
  }

  @Get('publishers')
  @ApiOperation({ summary: 'List publishers by name' })
  @ApiOkResponse({ type: CatalogItemDto, isArray: true })
  publishers(@Query() query: CatalogQueryDto): Promise<CatalogItemDto[]> {
    return this.catalog.list('publisher', query);
  }

  @Get('genres')
  @ApiOperation({ summary: 'List genres by name' })
  @ApiOkResponse({ type: CatalogItemDto, isArray: true })
  genres(@Query() query: CatalogQueryDto): Promise<CatalogItemDto[]> {
    return this.catalog.list('genre', query);
  }
}
