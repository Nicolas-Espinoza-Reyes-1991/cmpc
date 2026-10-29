import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trimText } from '../../common/transformers/trim-text.transformer';
import { MAX_SORT_CRITERIA, SORT_FIELDS } from '../book-list.query';
import { IsSort } from './is-sort.decorator';

export const LIST_DEFAULT_LIMIT = 10;
export const LIST_MAX_LIMIT = 100;
const FILTER_MAX_LENGTH = 100;

/** The query string sends booleans as text; anything else is left for `@IsBoolean` to reject. */
const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

export class ListBooksQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: LIST_MAX_LIMIT,
    default: LIST_DEFAULT_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LIST_MAX_LIMIT)
  limit: number = LIST_DEFAULT_LIMIT;

  @ApiPropertyOptional({
    description: 'Text contained in the title (any case).',
    example: 'dune',
    maxLength: FILTER_MAX_LENGTH,
  })
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(FILTER_MAX_LENGTH)
  search?: string;

  @ApiPropertyOptional({
    description: 'Text contained in the author name (any case).',
    maxLength: FILTER_MAX_LENGTH,
  })
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(FILTER_MAX_LENGTH)
  author?: string;

  @ApiPropertyOptional({
    description: 'Text contained in the publisher name (any case).',
    maxLength: FILTER_MAX_LENGTH,
  })
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(FILTER_MAX_LENGTH)
  publisher?: string;

  @ApiPropertyOptional({
    description: 'Text contained in the genre name (any case).',
    maxLength: FILTER_MAX_LENGTH,
  })
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(FILTER_MAX_LENGTH)
  genre?: string;

  @ApiPropertyOptional({ type: Boolean, example: true })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  availability?: boolean;

  @ApiPropertyOptional({
    description: `Comma-separated \`field:direction\` criteria in priority order. Fields: ${SORT_FIELDS.join(', ')}. At most ${MAX_SORT_CRITERIA}. Without it the newest book comes first. \`id\` is always added as the last criterion.`,
    example: 'genre:asc,price:desc',
  })
  @IsOptional()
  @IsSort()
  sort?: string;
}
