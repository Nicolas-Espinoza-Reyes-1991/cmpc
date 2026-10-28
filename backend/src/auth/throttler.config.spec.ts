import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { throttlerModuleOptions } from './throttler.config';

async function optionsFor(values: Record<string, unknown>) {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        ignoreEnvVars: true,
        load: [() => values],
      }),
    ],
  }).compile();
  return throttlerModuleOptions(moduleRef.get(ConfigService));
}

describe('throttlerModuleOptions', () => {
  it('turns THROTTLE_TTL seconds into the milliseconds the library wants', async () => {
    const options = await optionsFor({ THROTTLE_TTL: 60, THROTTLE_LIMIT: 5 });

    expect(options).toMatchObject({
      throttlers: [{ ttl: 60_000, limit: 5 }],
    });
  });

  it('honours other values from the environment', async () => {
    const options = await optionsFor({ THROTTLE_TTL: 10, THROTTLE_LIMIT: 2 });

    expect(options).toMatchObject({ throttlers: [{ ttl: 10_000, limit: 2 }] });
  });

  it('replaces the default message, which exposes an internal class name', async () => {
    const options = await optionsFor({ THROTTLE_TTL: 60, THROTTLE_LIMIT: 5 });

    expect(options).toMatchObject({ errorMessage: 'Too many requests' });
  });
});
