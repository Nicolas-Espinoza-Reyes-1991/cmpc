import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-request.types';
import { AuthService, type LoginResult } from './auth.service';
import { LoginResponseDto, UserDto } from './dto/login-response.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Public, and the only route behind the rate limiter (A4.1, A4.2). Guards run
   * before validation, so a malformed body also counts as an attempt.
   */
  @Public()
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({
    summary: 'Log in with email and password',
    description:
      'Returns a JWT. The response is wrapped as `{ data: ... }`; `data` has the shape below.',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid body (errors listed per field).',
  })
  @ApiUnauthorizedResponse({
    description: 'Wrong email or password (the same answer for both).',
  })
  @ApiTooManyRequestsResponse({
    description: 'Too many attempts from this IP; see the Retry-After header.',
  })
  login(@Body() dto: LoginDto): Promise<LoginResult> {
    return this.authService.login(dto.email, dto.password);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'The user the token belongs to' })
  @ApiOkResponse({ type: UserDto })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid or expired token.',
  })
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
