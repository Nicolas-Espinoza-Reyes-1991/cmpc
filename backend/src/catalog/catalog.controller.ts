import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiDataResponse } from '../common/swagger/api-data-response.decorator';
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
  @ApiDataResponse(CatalogItemDto, {
    description: 'The matching names, in `data`.',
    isArray: true,
  })
  authors(@Query() query: CatalogQueryDto): Promise<CatalogItemDto[]> {
    return this.catalog.list('author', query);
  }

  @Get('publishers')
  @ApiOperation({ summary: 'List publishers by name' })
  @ApiDataResponse(CatalogItemDto, {
    description: 'The matching names, in `data`.',
    isArray: true,
  })
  publishers(@Query() query: CatalogQueryDto): Promise<CatalogItemDto[]> {
    return this.catalog.list('publisher', query);
  }

  @Get('genres')
  @ApiOperation({ summary: 'List genres by name' })
  @ApiDataResponse(CatalogItemDto, {
    description: 'The matching names, in `data`.',
    isArray: true,
  })
  genres(@Query() query: CatalogQueryDto): Promise<CatalogItemDto[]> {
    return this.catalog.list('genre', query);
  }
}
