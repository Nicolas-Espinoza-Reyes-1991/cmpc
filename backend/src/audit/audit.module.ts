import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/** PrismaModule is global, so the service only needs to be exported. */
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
