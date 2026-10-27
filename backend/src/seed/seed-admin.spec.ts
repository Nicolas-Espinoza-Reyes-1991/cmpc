import * as argon2 from 'argon2';
import { SeedClient, seedAdmin } from './seed-admin';

interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
}

/** In-memory stand-in that honours upsert semantics (create only when missing). */
function createFakeClient(): { client: SeedClient; users: StoredUser[] } {
  const users: StoredUser[] = [];
  const client: SeedClient = {
    user: {
      upsert: ({ where, create }) => {
        let user = users.find((u) => u.email === where.email);
        if (!user) {
          user = { id: `id-${users.length + 1}`, ...create };
          users.push(user);
        }
        return Promise.resolve(user);
      },
    },
  };
  return { client, users };
}

const validEnv = {
  ADMIN_EMAIL: 'Admin@CMPC.local',
  ADMIN_PASSWORD: 'a-strong-password',
};

describe('seedAdmin', () => {
  it('creates the admin with a normalized email', async () => {
    const { client, users } = createFakeClient();

    const admin = await seedAdmin(client, validEnv);

    expect(admin.email).toBe('admin@cmpc.local');
    expect(users).toHaveLength(1);
  });

  it('stores an argon2 hash, never the plain password', async () => {
    const { client, users } = createFakeClient();

    await seedAdmin(client, validEnv);

    const stored = users[0]!.passwordHash;
    expect(stored).not.toBe(validEnv.ADMIN_PASSWORD);
    expect(stored.startsWith('$argon2id$')).toBe(true);
    await expect(argon2.verify(stored, validEnv.ADMIN_PASSWORD)).resolves.toBe(
      true,
    );
  });

  it('is idempotent and keeps the existing user untouched', async () => {
    const { client, users } = createFakeClient();

    const first = await seedAdmin(client, validEnv);
    const originalHash = users[0]!.passwordHash;
    const second = await seedAdmin(client, {
      ...validEnv,
      ADMIN_PASSWORD: 'another-password-1',
    });

    expect(users).toHaveLength(1);
    expect(second.id).toBe(first.id);
    expect(users[0]!.passwordHash).toBe(originalHash);
  });

  it('fails naming both variables when they are missing', async () => {
    const { client, users } = createFakeClient();

    await expect(seedAdmin(client, {})).rejects.toThrow(
      /ADMIN_EMAIL.*ADMIN_PASSWORD/,
    );
    expect(users).toHaveLength(0);
  });

  it('rejects an invalid email', async () => {
    const { client } = createFakeClient();

    await expect(
      seedAdmin(client, { ...validEnv, ADMIN_EMAIL: 'not-an-email' }),
    ).rejects.toThrow(/ADMIN_EMAIL/);
  });

  it('rejects a password shorter than 8 characters', async () => {
    const { client, users } = createFakeClient();

    await expect(
      seedAdmin(client, { ...validEnv, ADMIN_PASSWORD: 'short' }),
    ).rejects.toThrow(/ADMIN_PASSWORD/);
    expect(users).toHaveLength(0);
  });
});
