import { ApiProperty } from '@nestjs/swagger';

export class UserDto {
  @ApiProperty({ example: '3017f450-2092-454d-9a62-14ad55557302' })
  id!: string;

  @ApiProperty({ example: 'admin@cmpc.local' })
  email!: string;
}

/**
 * Describes the content of `data` in the response: every success is wrapped as
 * `{ data: ... }` by the TransformInterceptor.
 */
export class LoginResponseDto {
  @ApiProperty({
    description: 'JWT to send as "Authorization: Bearer <token>".',
  })
  accessToken!: string;

  @ApiProperty({ enum: ['Bearer'] })
  tokenType!: 'Bearer';

  @ApiProperty({
    example: '2026-10-28T03:12:33.000Z',
    description: 'Moment the token stops being valid (ISO 8601).',
  })
  expiresAt!: string;

  @ApiProperty({ type: UserDto })
  user!: UserDto;
}
