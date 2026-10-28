import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { softDeleteExtension } from './soft-delete.extension';

/**
 * Single typed gateway to PostgreSQL. Services depend on this class (injected),
 * never on a client they create themselves, so tests can replace it (R3.4).
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  /**
   * Same connection, but books marked as deleted are invisible. Anything that
   * reads or writes books uses this client; `$extends` returns a new client, so
   * it cannot replace `this`.
   */
  readonly live = this.$extends(softDeleteExtension);

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
