import { PasswordHasher } from './password-hasher';

describe('PasswordHasher (real argon2)', () => {
  const hasher = new PasswordHasher();

  it('hashes with argon2id and never keeps the plain password', async () => {
    const hash = await hasher.hash('correct horse battery staple');

    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain('correct horse');
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hasher.hash('s3cret-password');

    await expect(hasher.verify(hash, 's3cret-password')).resolves.toBe(true);
    await expect(hasher.verify(hash, 's3cret-passwore')).resolves.toBe(false);
  });

  it('salts every hash, so the same password never produces the same one twice', async () => {
    const [first, second] = await Promise.all([
      hasher.hash('same-password'),
      hasher.hash('same-password'),
    ]);

    expect(first).not.toBe(second);
  });

  it('uses the default cost parameters, the same as the seed', async () => {
    const hash = await hasher.hash('x');

    // argon2 prints the parameters as m (memory KiB), p (parallelism), t (iterations).
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=65536,p=4,t=3\$/);
  });

  it('rejects instead of answering false when the stored hash is corrupt', async () => {
    await expect(hasher.verify('not-a-hash', 'x')).rejects.toThrow();
  });
});
