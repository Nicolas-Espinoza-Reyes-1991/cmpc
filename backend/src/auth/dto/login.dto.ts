import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Trim and lower-case the email before it is validated (A1.4). */
const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class LoginDto {
  @ApiProperty({ example: 'admin@cmpc.local', maxLength: 254 })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  // 128 characters is far more than anyone types and keeps argon2 from hashing huge bodies (A1.5).
  @ApiProperty({ example: 'change-me', maxLength: 128 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}
