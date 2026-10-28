import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { RawResponse } from '../common/decorators/raw-response.decorator';
import { HealthService, HealthStatus } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /** Public and un-enveloped: load balancers and Docker only read the status code. */
  @Public()
  @RawResponse()
  @Get()
  @ApiOperation({
    summary: 'Check that the API and its database are up',
    description:
      'Public, and not wrapped in `{ data }`: probes only read the status code.',
  })
  @ApiOkResponse({
    description: 'The API answers and PostgreSQL replies.',
    schema: { example: { status: 'ok' } },
  })
  @ApiServiceUnavailableResponse({
    description: 'PostgreSQL does not reply (within 3 seconds).',
  })
  check(): Promise<HealthStatus> {
    return this.healthService.check();
  }
}
