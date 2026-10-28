import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(() => {
    // The client only reads the URL when it connects; this keeps the test hermetic.
    process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
    service = new PrismaService();
  });

  it('connects when the module initializes', async () => {
    const connect = jest.spyOn(service, '$connect').mockResolvedValue();

    await service.onModuleInit();

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('disconnects when the module is destroyed', async () => {
    const disconnect = jest.spyOn(service, '$disconnect').mockResolvedValue();

    await service.onModuleDestroy();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('propagates connection errors so the application fails fast', async () => {
    jest.spyOn(service, '$connect').mockRejectedValue(new Error('db down'));

    await expect(service.onModuleInit()).rejects.toThrow('db down');
  });
});
