import { ApiProperty } from '@nestjs/swagger';
import type { CatalogItem } from '../catalog-kind';

export class CatalogItemDto implements CatalogItem {
  @ApiProperty({ example: '3f6c2a52-7f0e-4c3e-9d57-1d8f0f6a9b11' })
  id!: string;

  @ApiProperty({ example: 'Editorial Planeta' })
  name!: string;
}
