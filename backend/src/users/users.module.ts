import { Module } from '@nestjs/common';
import { UsersService } from './users.service';

/** PrismaModule is global, so the service gets PrismaService without importing it. */
@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
