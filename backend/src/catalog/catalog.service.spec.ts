import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import type { CatalogClient, CatalogKind } from './catalog-kind';
import { CatalogService } from './catalog.service';

const KINDS: CatalogKind[] = ['author', 'publisher', 'genre'];

function fakeClient() {
  const delegate = () => ({
    findMany: jest.fn().mockResolvedValue([{ id: 'c1', name: 'Planeta' }]),
    findFirst: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockResolvedValue({ id: 'new-id' }),
  });
  return { author: delegate(), publisher: delegate(), genre: delegate() };
}

describe('CatalogService', () => {
  let prisma: ReturnType<typeof fakeClient>;
  let service: CatalogService;

  beforeEach(async () => {
    prisma = fakeClient();
    const moduleRef = await Test.createTestingModule({
      providers: [CatalogService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(CatalogService);
  });

  describe('list', () => {
    it.each(KINDS)('reads only the %s table, ordered by name', async (kind) => {
      const result = await service.list(kind, { limit: 20 });

      expect(result).toEqual([{ id: 'c1', name: 'Planeta' }]);
      expect(prisma[kind].findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { name: 'asc' },
        take: 20,
        select: { id: true, name: true },
      });
      for (const other of KINDS.filter((k) => k !== kind)) {
        expect(prisma[other].findMany).not.toHaveBeenCalled();
      }
    });

    it('filters by a name that contains the search, ignoring case', async () => {
      await service.list('publisher', { search: 'plan', limit: 5 });

      expect(prisma.publisher.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: { contains: 'plan', mode: 'insensitive' } },
          take: 5,
        }),
      );
    });

    it.each([
      ['a_b', 'a\\_b'],
      ['100%', '100\\%'],
      ['a\\b', 'a\\\\b'],
    ])(
      'searches %j as literal text, not as LIKE wildcards',
      async (search, escaped) => {
        await service.list('author', { search, limit: 20 });

        expect(prisma.author.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { name: { contains: escaped, mode: 'insensitive' } },
          }),
        );
      },
    );

    it('treats an empty search as no filter', async () => {
      await service.list('genre', { search: '', limit: 20 });

      expect(prisma.genre.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: undefined }),
      );
    });
  });

  describe('resolve', () => {
    // The transaction client has the same three delegates as the plain client.
    const tx = (): CatalogClient => prisma;

    it('returns the id of an existing entry, ignoring case, without creating anything', async () => {
      prisma.publisher.findFirst.mockResolvedValue({ id: 'existing' });

      const id = await service.resolve(tx(), 'publisher', 'planeta');

      expect(id).toBe('existing');
      expect(prisma.publisher.findFirst).toHaveBeenCalledWith({
        where: { name: { equals: 'planeta', mode: 'insensitive' } },
        select: { id: true },
      });
      expect(prisma.publisher.upsert).not.toHaveBeenCalled();
    });

    it('creates the entry with an upsert on the exact name when none matches (a non-empty update makes Prisma use ON CONFLICT)', async () => {
      const id = await service.resolve(tx(), 'author', 'Isabel Allende');

      expect(id).toBe('new-id');
      expect(prisma.author.upsert).toHaveBeenCalledWith({
        where: { name: 'Isabel Allende' },
        update: { name: 'Isabel Allende' },
        create: { name: 'Isabel Allende' },
        select: { id: true },
      });
    });

    it('uses the client it is given, so the work belongs to the caller transaction', async () => {
      const other = fakeClient();
      other.genre.findFirst.mockResolvedValue({ id: 'from-tx' });

      const id = await service.resolve(other, 'genre', 'Novela');

      expect(id).toBe('from-tx');
      expect(prisma.genre.findFirst).not.toHaveBeenCalled();
    });

    it('lets a failure propagate so the transaction rolls back', async () => {
      prisma.genre.upsert.mockRejectedValue(new Error('db down'));

      await expect(service.resolve(tx(), 'genre', 'Novela')).rejects.toThrow(
        'db down',
      );
    });
  });
});
