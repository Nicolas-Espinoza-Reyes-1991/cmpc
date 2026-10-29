import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';
import type { AuditClient, AuditEntry } from './audit.types';

const actor = { userId: 'user-1', ip: '203.0.113.7' };
const entry: AuditEntry = {
  action: 'UPDATE',
  entity: 'Book',
  entityId: 'book-1',
  before: { title: 'Antes' },
  after: { title: 'Después' },
  actor,
};

describe('AuditService', () => {
  let service: AuditService;
  const create = jest.fn();
  const client = { auditLog: { create } } as unknown as AuditClient;

  beforeEach(async () => {
    create.mockReset().mockResolvedValue({});
    const module = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: client }],
    }).compile();
    service = module.get(AuditService);
  });

  describe('log', () => {
    it('writes the entry with the client it is given', async () => {
      const otherCreate = jest.fn().mockResolvedValue({});
      const other = {
        auditLog: { create: otherCreate },
      } as unknown as AuditClient;

      await service.log(other, entry);

      expect(otherCreate).toHaveBeenCalledWith({
        data: {
          action: 'UPDATE',
          entity: 'Book',
          entityId: 'book-1',
          before: { title: 'Antes' },
          after: { title: 'Después' },
          userId: 'user-1',
          ip: '203.0.113.7',
        },
      });
      expect(create).not.toHaveBeenCalled();
    });

    it('stores a missing before, after and entity id as SQL NULL', async () => {
      await service.log(client, {
        action: 'LOGIN_FAILED',
        entity: 'User',
        actor: { userId: null, ip: null },
      });

      expect(create).toHaveBeenCalledWith({
        data: {
          action: 'LOGIN_FAILED',
          entity: 'User',
          entityId: null,
          before: Prisma.DbNull,
          after: Prisma.DbNull,
          userId: null,
          ip: null,
        },
      });
    });

    it('treats an explicit null like a missing snapshot', async () => {
      await service.log(client, { ...entry, before: null, after: null });

      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          before: Prisma.DbNull,
          after: Prisma.DbNull,
        }) as unknown,
      });
    });

    it('lets the failure through so the transaction is undone', async () => {
      create.mockRejectedValue(new Error('disk full'));

      await expect(service.log(client, entry)).rejects.toThrow('disk full');
    });
  });

  describe('logBestEffort', () => {
    it('writes through the Prisma service', async () => {
      await service.logBestEffort(entry);

      expect(create).toHaveBeenCalledTimes(1);
    });

    it('swallows a failure and logs it without the content of the entry', async () => {
      const error = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      create.mockRejectedValue(new Error('connection lost'));

      await expect(service.logBestEffort(entry)).resolves.toBeUndefined();

      expect(error).toHaveBeenCalledTimes(1);
      const message = String(error.mock.calls[0]?.[0]);
      expect(message).toContain('UPDATE');
      expect(message).toContain('connection lost');
      expect(message).not.toContain('Antes');
      expect(message).not.toContain('203.0.113.7');
      error.mockRestore();
    });
  });
});
