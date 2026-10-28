import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { HEALTH_CHECK_TIMEOUT_MS, HealthService } from './health.service';

describe('HealthService', () => {
  const queryRaw = jest.fn();
  let service: HealthService;
  let logError: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const moduleRef = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: { $queryRaw: queryRaw } },
      ],
    }).compile();
    service = moduleRef.get(HealthService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('answers ok when the database replies', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    await expect(service.check()).resolves.toEqual({ status: 'ok' });
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(logError).not.toHaveBeenCalled();
  });

  it('answers 503 and logs the cause when the query fails', async () => {
    const cause = new Error('connection refused');
    queryRaw.mockRejectedValue(cause);

    await expect(service.check()).rejects.toThrow(ServiceUnavailableException);
    expect(logError).toHaveBeenCalledWith(
      'Database health check failed',
      cause.stack,
    );
  });

  it('does not leak the database error to the caller', async () => {
    queryRaw.mockRejectedValue(new Error('password authentication failed'));

    await expect(service.check()).rejects.toThrow('Database unavailable');
  });

  it('logs failures that are not Error instances', async () => {
    queryRaw.mockRejectedValue('weird failure');

    await expect(service.check()).rejects.toThrow(ServiceUnavailableException);
    expect(logError).toHaveBeenCalledWith(
      'Database health check failed',
      'weird failure',
    );
  });

  it('answers 503 instead of hanging when the database never replies', async () => {
    jest.useFakeTimers();
    queryRaw.mockReturnValue(new Promise(() => undefined));

    const result = service.check();
    // Attach the handler before advancing time so the rejection is never unhandled.
    const assertion = expect(result).rejects.toThrow('Database unavailable');
    await jest.advanceTimersByTimeAsync(HEALTH_CHECK_TIMEOUT_MS);

    await assertion;
    expect(logError).toHaveBeenCalledWith(
      'Database health check failed',
      expect.stringContaining('timed out') as string,
    );
  });

  it('clears the timeout once the database has replied', async () => {
    jest.useFakeTimers();
    queryRaw.mockResolvedValue([]);

    await service.check();

    expect(jest.getTimerCount()).toBe(0);
  });
});
