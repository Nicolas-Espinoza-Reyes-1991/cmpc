import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trimText } from '../../common/transformers/trim-text.transformer';

export const CATALOG_DEFAULT_LIMIT = 20;
export const CATALOG_MAX_LIMIT = 50;

export class CatalogQueryDto {
  @ApiPropertyOptional({
    description: 'Text contained in the name (any case).',
    example: 'plan',
    maxLength: 100,
  })
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: CATALOG_MAX_LIMIT,
    default: CATALOG_DEFAULT_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(CATALOG_MAX_LIMIT)
  limit: number = CATALOG_DEFAULT_LIMIT;
}
