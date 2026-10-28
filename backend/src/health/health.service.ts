import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const HEALTH_CHECK_TIMEOUT_MS = 3000;

export interface HealthStatus {
  status: 'ok';
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Answers ok only if PostgreSQL replies; otherwise 503 (R6.3). */
  async check(): Promise<HealthStatus> {
    try {
      await this.pingDatabase();
    } catch (error) {
      this.logger.error(
        'Database health check failed',
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException('Database unavailable');
    }

    return { status: 'ok' };
  }

  /** The probe must not hang with the database: it fails after a short timeout. */
  private async pingDatabase(): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error('Database ping timed out')),
        HEALTH_CHECK_TIMEOUT_MS,
      );
    });

    try {
      await Promise.race([this.prisma.$queryRaw`SELECT 1`, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}
