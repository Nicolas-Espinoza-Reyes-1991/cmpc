import { ApiProperty } from '@nestjs/swagger';

/**
 * Describes the content of `data` in the book responses. Names are plain text
 * (the same shape the form sends); `deletedAt` is never exposed (C3.2).
 */
export class BookDto {
  @ApiProperty({ example: '3f6c2a52-7f0e-4c3e-9d57-1d8f0f6a9b11' })
  id!: string;

  @ApiProperty({ example: 'Cien años de soledad' })
  title!: string;

  @ApiProperty({ example: 'Gabriel García Márquez' })
  author!: string;

  @ApiProperty({ example: 'Editorial Sudamericana' })
  publisher!: string;

  @ApiProperty({ example: 'Novela' })
  genre!: string;

  @ApiProperty({ example: 12990 })
  price!: number;

  @ApiProperty({ example: true })
  availability!: boolean;

  @ApiProperty({
    nullable: true,
    type: String,
    example: null,
    description: 'Cover image URL, set by the image upload.',
  })
  imageUrl!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
