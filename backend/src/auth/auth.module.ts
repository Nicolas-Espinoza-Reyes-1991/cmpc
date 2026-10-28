import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { jwtModuleOptions } from './jwt.config';
import { JwtStrategy } from './jwt.strategy';
import { PasswordHasher } from './password-hasher';
import { throttlerModuleOptions } from './throttler.config';

/**
 * The JWT guard is registered with APP_GUARD, so it protects the whole
 * application, not only this module's routes. The throttler is NOT global: only
 * the login route opts in with @UseGuards(ThrottlerGuard).
 */
@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: jwtModuleOptions,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: throttlerModuleOptions,
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordHasher,
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
