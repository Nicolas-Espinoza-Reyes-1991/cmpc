import { Logger } from '@nestjs/common';
import { existsSync } from 'node:fs';
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ImageStorage, UPLOADS_ROUTE, uploadDirectory } from './image-storage';

const NAME = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;
const config = (dir: string) => ({ get: () => dir }) as never;

describe('ImageStorage', () => {
  let root: string;
  let dir: string;
  let storage: ImageStorage;
  let warn: jest.SpyInstance;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'cmpc-images-'));
    // A directory that does not exist yet: a fresh volume.
    dir = join(root, 'uploads');
    storage = new ImageStorage(config(dir));
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(async () => {
    warn.mockRestore();
    await rm(root, { recursive: true, force: true });
  });

  it('creates the upload directory when the module starts, even nested', async () => {
    const nested = join(root, 'a', 'b', 'uploads');

    await new ImageStorage(config(nested)).onModuleInit();

    expect(existsSync(nested)).toBe(true);
  });

  it('does not fail when the directory already exists', async () => {
    await mkdir(dir, { recursive: true });

    await expect(storage.onModuleInit()).resolves.toBeUndefined();
  });

  describe('save', () => {
    beforeEach(async () => {
      await storage.onModuleInit();
    });

    it('writes the bytes under a generated name with the given extension', async () => {
      const bytes = Buffer.from([1, 2, 3, 4]);

      const name = await storage.save(bytes, 'png');

      expect(name).toMatch(NAME);
      expect(name.endsWith('.png')).toBe(true);
      expect(await readFile(join(dir, name))).toEqual(bytes);
    });

    it.each(['jpg', 'png', 'webp'] as const)(
      'keeps the extension %s',
      async (extension) => {
        expect(
          (await storage.save(Buffer.from('x'), extension)).endsWith(
            `.${extension}`,
          ),
        ).toBe(true);
      },
    );

    it('never reuses a name: every save makes a new file', async () => {
      const names = await Promise.all(
        Array.from({ length: 20 }, () => storage.save(Buffer.from('x'), 'png')),
      );

      expect(new Set(names).size).toBe(20);
      expect(await readdir(dir)).toHaveLength(20);
    });

    it('fails when the directory cannot be written, so the caller can clean up', async () => {
      const broken = new ImageStorage(
        config(join(root, 'does', 'not', 'exist')),
      );

      await expect(broken.save(Buffer.from('x'), 'png')).rejects.toThrow();
    });
  });

  describe('remove', () => {
    beforeEach(async () => {
      await storage.onModuleInit();
    });

    it('deletes a stored file', async () => {
      const name = await storage.save(Buffer.from('x'), 'jpg');

      await storage.remove(name);

      expect(await readdir(dir)).toEqual([]);
      expect(warn).not.toHaveBeenCalled();
    });

    it('is quiet when the file is already gone', async () => {
      await expect(
        storage.remove('3f6c2a52-7f0e-4c3e-9d57-1d8f0f6a9b11.png'),
      ).resolves.toBeUndefined();

      expect(warn).not.toHaveBeenCalled();
    });

    it.each([
      ['a path traversal', '../secret.png'],
      ['a nested path', 'a/3f6c2a52-7f0e-4c3e-9d57-1d8f0f6a9b11.png'],
      ['an absolute path', '/etc/passwd'],
      ['a name that is not a UUID', 'cover.png'],
      [
        'an extension that is not an image',
        '3f6c2a52-7f0e-4c3e-9d57-1d8f0f6a9b11.exe',
      ],
      ['a hidden file', '.env'],
      ['an empty name', ''],
      [
        'a name with a trailing space',
        '3f6c2a52-7f0e-4c3e-9d57-1d8f0f6a9b11.png ',
      ],
    ])('refuses to touch the disk for %s and logs it', async (_label, name) => {
      await writeFile(join(root, 'secret.png'), 'keep me');

      await storage.remove(name);

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('unexpected name'),
      );
      expect(await readFile(join(root, 'secret.png'), 'utf8')).toBe('keep me');
    });

    it('logs, without throwing, a file that exists but cannot be deleted', async () => {
      // A directory with a valid name: `unlink` cannot delete it (EPERM or EISDIR).
      const name = '3f6c2a52-7f0e-4c3e-9d57-1d8f0f6a9b11.png';
      await mkdir(join(dir, name));

      await expect(storage.remove(name)).resolves.toBeUndefined();

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not delete'),
      );
    });
  });

  describe('urlFor and nameFromUrl', () => {
    const name = '3f6c2a52-7f0e-4c3e-9d57-1d8f0f6a9b11.webp';

    it('builds a relative URL under the API prefix', () => {
      expect(storage.urlFor(name)).toBe(`/api/uploads/${name}`);
      expect(UPLOADS_ROUTE).toBe('/api/uploads');
    });

    it('reads the name back from the URL it made', () => {
      expect(storage.nameFromUrl(storage.urlFor(name))).toBe(name);
    });

    it.each([
      ['null', null],
      ['an empty URL', ''],
      ['another site', `https://evil.test/api/uploads/${name}`],
      ['another prefix', `/uploads/${name}`],
      ['a path traversal', '/api/uploads/../secret.png'],
      ['a nested path', `/api/uploads/x/${name}`],
      ['a name that is not ours', '/api/uploads/cover.png'],
      ['a name with a query', `/api/uploads/${name}?x=1`],
    ])('gives null for %s', (_label, url) => {
      expect(storage.nameFromUrl(url)).toBeNull();
    });
  });

  it('resolves UPLOAD_DIR to an absolute path', () => {
    expect(uploadDirectory(config('./uploads'))).toMatch(/uploads$/);
    expect(uploadDirectory(config('./uploads'))).not.toBe('./uploads');
  });
});
