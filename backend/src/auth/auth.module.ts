import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { jwtModuleOptions } from './jwt.config';
import { PasswordHasher } from './password-hasher';

/**
 * Grows over the next tasks: the JWT strategy and global guard (A-04) and the
 * controller with rate limiting (A-05) are added here.
 */
@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: jwtModuleOptions,
    }),
  ],
  providers: [AuthService, PasswordHasher],
  exports: [AuthService],
})
export class AuthModule {}
