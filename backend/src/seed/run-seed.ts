import { existsSync } from 'node:fs';
import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { seedAdmin } from './seed-admin';

/**
 * Entry point of the seed. In Docker it runs compiled (`node dist/seed/run-seed.js`);
 * locally `npm run seed` or `prisma db seed` run it with ts-node.
 */
async function main(): Promise<void> {
  const logger = new Logger('Seed');

  // Local runs read `.env`; real environment variables (Docker) take precedence.
  for (const file of ['.env', '../.env']) {
    if (existsSync(file)) process.loadEnvFile(file);
  }

  const prisma = new PrismaClient();
  try {
    const admin = await seedAdmin(prisma, process.env);
    logger.log(`Admin user ready: ${admin.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  new Logger('Seed').error(error instanceof Error ? error.message : error);
  process.exit(1);
});
