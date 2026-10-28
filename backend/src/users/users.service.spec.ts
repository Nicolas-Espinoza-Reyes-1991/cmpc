import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

const storedUser = {
  id: '8c69db2b-ec96-46ea-a0da-fc55b236555a',
  email: 'admin@cmpc.local',
  passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$salt$hash',
  createdAt: new Date('2026-10-27T00:00:00.000Z'),
};

describe('UsersService', () => {
  const findUnique = jest.fn();
  let service: UsersService;

  beforeEach(async () => {
    findUnique.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: { user: { findUnique } } },
      ],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  describe('findByEmail', () => {
    it('returns the whole user, including the hash the login needs', async () => {
      findUnique.mockResolvedValue(storedUser);

      await expect(service.findByEmail('admin@cmpc.local')).resolves.toBe(
        storedUser,
      );
      expect(findUnique).toHaveBeenCalledWith({
        where: { email: 'admin@cmpc.local' },
      });
    });

    it('looks the email up in lower case and without surrounding spaces', async () => {
      findUnique.mockResolvedValue(storedUser);

      await service.findByEmail('  Admin@CMPC.Local ');

      expect(findUnique).toHaveBeenCalledWith({
        where: { email: 'admin@cmpc.local' },
      });
    });

    it('returns null when nobody has that email', async () => {
      findUnique.mockResolvedValue(null);

      await expect(
        service.findByEmail('nobody@cmpc.local'),
      ).resolves.toBeNull();
    });
  });

  describe('findById', () => {
    it('asks the database for the id and the email only, never the hash', async () => {
      findUnique.mockResolvedValue({
        id: storedUser.id,
        email: storedUser.email,
      });

      await expect(service.findById(storedUser.id)).resolves.toEqual({
        id: storedUser.id,
        email: storedUser.email,
      });
      expect(findUnique).toHaveBeenCalledWith({
        where: { id: storedUser.id },
        select: { id: true, email: true },
      });
    });

    it('returns null when the user no longer exists', async () => {
      findUnique.mockResolvedValue(null);

      await expect(service.findById(storedUser.id)).resolves.toBeNull();
    });

    it.each([
      ['plain text', 'not-a-uuid'],
      ['an empty string', ''],
      ['a number', '12345'],
      ['an injection attempt', "' OR 1=1 --"],
      ['a UUID with extra characters', `${storedUser.id}x`],
    ])(
      'answers null without querying when the id is %s',
      async (_label, id) => {
        await expect(service.findById(id)).resolves.toBeNull();

        expect(findUnique).not.toHaveBeenCalled();
      },
    );

    it('accepts a UUID written in upper case', async () => {
      findUnique.mockResolvedValue({
        id: storedUser.id,
        email: storedUser.email,
      });

      await service.findById(storedUser.id.toUpperCase());

      expect(findUnique).toHaveBeenCalledTimes(1);
    });
  });

  it('propagates database errors instead of hiding them', async () => {
    findUnique.mockRejectedValue(new Error('connection lost'));

    await expect(service.findByEmail('admin@cmpc.local')).rejects.toThrow(
      'connection lost',
    );
    await expect(service.findById(storedUser.id)).rejects.toThrow(
      'connection lost',
    );
  });
});
