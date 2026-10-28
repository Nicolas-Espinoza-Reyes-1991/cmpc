import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { jwtModuleOptions } from './jwt.config';
import { JwtStrategy } from './jwt.strategy';
import { PasswordHasher } from './password-hasher';

/**
 * Grows over the next tasks: the controller with rate limiting is added in A-05.
 * The guard is registered with APP_GUARD, so it protects the whole application,
 * not only this module's routes.
 */
@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: jwtModuleOptions,
    }),
  ],
  providers: [
    AuthService,
    PasswordHasher,
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
