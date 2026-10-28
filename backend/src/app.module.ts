import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // `backend/.env` first (Docker), then the repository root `.env` (local dev).
      envFilePath: ['.env', '../.env'],
      validate: validateEnv,
    }),
    PrismaModule,
    // AuthModule registers the global JWT guard: from here on every route is
    // protected unless it is marked @Public().
    AuthModule,
    HealthModule,
    CatalogModule,
  ],
})
export class AppModule {}
