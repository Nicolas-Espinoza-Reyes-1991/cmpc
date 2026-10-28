import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { RawResponse } from '../common/decorators/raw-response.decorator';
import { HealthService, HealthStatus } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /** Public and un-enveloped: load balancers and Docker only read the status code. */
  @Public()
  @RawResponse()
  @Get()
  check(): Promise<HealthStatus> {
    return this.healthService.check();
  }
}
