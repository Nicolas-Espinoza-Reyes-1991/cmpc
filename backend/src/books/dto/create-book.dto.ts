import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trimText } from '../../common/transformers/trim-text.transformer';
import { IsMoney } from '../../common/validation/is-money.decorator';

/** Limits of the book fields. The frontend schema mirrors them. */
export const TITLE_MAX_LENGTH = 200;
export const NAME_MAX_LENGTH = 100;
// Decimal(10,2) in the database: eight integer digits and two decimals.
export const PRICE_MAX = 99_999_999.99;

export class CreateBookDto {
  @ApiProperty({ example: 'Cien años de soledad', maxLength: TITLE_MAX_LENGTH })
  @Transform(trimText)
  @IsString()
  @IsNotEmpty()
  @MaxLength(TITLE_MAX_LENGTH)
  title!: string;

  @ApiProperty({
    description: 'Author name. Created if it does not exist yet.',
    example: 'Gabriel García Márquez',
    maxLength: NAME_MAX_LENGTH,
  })
  @Transform(trimText)
  @IsString()
  @IsNotEmpty()
  @MaxLength(NAME_MAX_LENGTH)
  author!: string;

  @ApiProperty({
    description: 'Publisher name. Created if it does not exist yet.',
    example: 'Editorial Sudamericana',
    maxLength: NAME_MAX_LENGTH,
  })
  @Transform(trimText)
  @IsString()
  @IsNotEmpty()
  @MaxLength(NAME_MAX_LENGTH)
  publisher!: string;

  @ApiProperty({
    description: 'Genre name. Created if it does not exist yet.',
    example: 'Novela',
    maxLength: NAME_MAX_LENGTH,
  })
  @Transform(trimText)
  @IsString()
  @IsNotEmpty()
  @MaxLength(NAME_MAX_LENGTH)
  genre!: string;

  @ApiProperty({
    description: 'Greater than 0, at most two decimals.',
    example: 12990,
    minimum: 0.01,
    maximum: PRICE_MAX,
  })
  @IsMoney({ max: PRICE_MAX })
  price!: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  availability!: boolean;
}
