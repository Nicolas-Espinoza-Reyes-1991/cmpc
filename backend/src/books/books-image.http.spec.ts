import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { configureApp } from '../app.setup';
import { AuthModule } from '../auth/auth.module';
import { validateEnv } from '../config/env.validation';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { BooksModule } from './books.module';
import { MAX_IMAGE_BYTES } from './images/image-upload.config';

const SECRET = 'image-http-test-secret-with-at-least-32-chars';
const USER = {
  id: '3017f450-2092-454d-9a62-14ad55557302',
  email: 'admin@cmpc.local',
};
const ID = '3f6c2a52-7f0e-4c3e-9d57-1d8f0f6a9b11';
const createdAt = new Date('2026-10-28T10:00:00.000Z');

const bookRow = (imageUrl: string | null) => ({
  id: ID,
  title: 'Dune',
  price: new Prisma.Decimal('9990.5'),
  availability: true,
  imageUrl,
  authorId: 'a',
  publisherId: 'p',
  genreId: 'g',
  createdAt,
  updatedAt: createdAt,
  deletedAt: null,
  author: { id: 'a', name: 'Frank Herbert', createdAt },
  publisher: { id: 'p', name: 'Ace', createdAt },
  genre: { id: 'g', name: 'Ciencia ficción', createdAt },
});

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const png = (size = 200) =>
  Buffer.concat([PNG_SIGNATURE, Buffer.alloc(size, 0x11)]);
const jpeg = () =>
  Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.alloc(200, 0x22),
  ]);
const webp = () =>
  Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.from([0x24, 0, 0, 0]),
    Buffer.from('WEBP'),
    Buffer.alloc(200, 0x33),
  ]);

const STORED = /^\/api\/uploads\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

/** The real guard, multer, validation, filter and file storage; only the database is faked. */
describe('book image over HTTP (real multipart and real files)', () => {
  const update = jest.fn();
  const findUnique = jest.fn();
  const auditCreate = jest.fn();
  const $transaction = jest.fn();
  let uploadDir: string;
  let app: NestExpressApplication;
  let auth: string;

  const api = () => request(app.getHttpServer());
  const files = () => readdir(uploadDir);
  const upload = (id = ID) =>
    api().post(`/api/books/${id}/image`).set('Authorization', auth);

  beforeAll(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'cmpc-http-images-'));
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          ignoreEnvVars: true,
          load: [
            () =>
              validateEnv({
                DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
                JWT_SECRET: SECRET,
                UPLOAD_DIR: uploadDir,
              }),
          ],
        }),
        PrismaModule,
        AuthModule,
        BooksModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({
        user: {
          findUnique: ({ where }: { where: { id?: string } }) =>
            Promise.resolve(where.id === USER.id ? { ...USER } : null),
        },
        live: { $transaction, book: { findUnique } },
      })
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      logger: false,
    });
    configureApp(app);
    await app.init();
    auth = `Bearer ${await app.get(JwtService).signAsync({ sub: USER.id })}`;
  });

  afterAll(async () => {
    await app.close();
    await rm(uploadDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    for (const name of await files()) await rm(join(uploadDir, name));
    update
      .mockReset()
      .mockImplementation(({ data }: { data: { imageUrl: string | null } }) =>
        Promise.resolve(bookRow(data.imageUrl)),
      );
    findUnique.mockReset().mockResolvedValue(bookRow(null));
    auditCreate.mockReset().mockResolvedValue({});
    $transaction
      .mockReset()
      .mockImplementation((work: (tx: unknown) => Promise<unknown>) =>
        work({
          book: { update, findUnique },
          auditLog: { create: auditCreate },
        }),
      );
  });

  describe('without a token', () => {
    it.each([['post'], ['delete']] as const)(
      '%s /api/books/:id/image answers 401 and writes nothing',
      async (method) => {
        const res = await api()
          [method](`/api/books/${ID}/image`)
          .attach('image', png(), 'cover.png');

        expect(res.status).toBe(401);
        expect(await files()).toEqual([]);
        expect(findUnique).not.toHaveBeenCalled();
      },
    );
  });

  describe('POST /api/books/:id/image', () => {
    it.each([
      ['PNG', png(), 'cover.png', 'image/png', '.png'],
      ['JPEG', jpeg(), 'cover.jpg', 'image/jpeg', '.jpg'],
      ['WebP', webp(), 'cover.webp', 'image/webp', '.webp'],
    ])(
      'stores a real %s and answers 200 with the book pointing at it',
      async (_label, bytes, filename, contentType, extension) => {
        const res = await upload()
          .attach('image', bytes, { filename, contentType })
          .expect(200);

        const { imageUrl } = (res.body as { data: { imageUrl: string } }).data;
        expect(imageUrl).toMatch(STORED);
        expect(imageUrl.endsWith(extension)).toBe(true);
        const stored = await files();
        expect(stored).toHaveLength(1);
        expect(await readFile(join(uploadDir, stored[0] as string))).toEqual(
          bytes,
        );
        expect(`/api/uploads/${stored[0]}`).toBe(imageUrl);
        expect(res.body).toMatchObject({ data: { id: ID, title: 'Dune' } });
      },
    );

    it('decides the type and the name by the content, never by what the client says', async () => {
      // A JPEG that the client calls "evil.html" and declares as text/html.
      const res = await upload()
        .attach('image', jpeg(), {
          filename: 'evil.html',
          contentType: 'text/html',
        })
        .expect(200);

      const { imageUrl } = (res.body as { data: { imageUrl: string } }).data;
      expect(imageUrl).toMatch(/\.jpg$/);
      expect(imageUrl).not.toContain('evil');
      expect((await files())[0]).not.toContain('evil');
    });

    it('never uses a path in the file name sent by the client', async () => {
      await upload()
        .attach('image', png(), {
          filename: '../../escape.png',
          contentType: 'image/png',
        })
        .expect(200);

      expect(await files()).toHaveLength(1);
      expect(await files()).not.toContain('escape.png');
    });

    it('accepts exactly 2 MB', async () => {
      const exactly = Buffer.concat([
        PNG_SIGNATURE,
        Buffer.alloc(MAX_IMAGE_BYTES - PNG_SIGNATURE.length, 0x44),
      ]);
      expect(exactly.length).toBe(MAX_IMAGE_BYTES);

      await upload().attach('image', exactly, 'big.png').expect(200);
    });

    it('answers 413 for 2 MB plus one byte and leaves nothing on disk', async () => {
      const tooBig = Buffer.concat([
        PNG_SIGNATURE,
        Buffer.alloc(MAX_IMAGE_BYTES - PNG_SIGNATURE.length + 1, 0x44),
      ]);

      const res = await upload().attach('image', tooBig, 'big.png').expect(413);

      expect(res.body).toMatchObject({ statusCode: 413 });
      expect(await files()).toEqual([]);
      expect($transaction).not.toHaveBeenCalled();
    });

    it.each([
      [
        'text renamed to .png',
        Buffer.from('this is not an image at all'),
        'a.png',
        'image/png',
      ],
      [
        'HTML claiming to be a PNG',
        Buffer.from('<html><script>alert(1)</script></html>'),
        'a.png',
        'image/png',
      ],
      [
        'an SVG',
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>',
        ),
        'a.svg',
        'image/svg+xml',
      ],
      ['a GIF', Buffer.from('GIF89a......'), 'a.gif', 'image/gif'],
      ['a PDF', Buffer.from('%PDF-1.7 ......'), 'a.pdf', 'application/pdf'],
      ['an empty file', Buffer.alloc(0), 'a.png', 'image/png'],
    ])(
      'answers 400 for %s and leaves nothing on disk',
      async (_label, bytes, filename, contentType) => {
        const res = await upload()
          .attach('image', bytes, { filename, contentType })
          .expect(400);

        expect(res.body).toMatchObject({
          statusCode: 400,
          message: expect.stringContaining('not a valid image') as unknown,
        });
        expect(await files()).toEqual([]);
        expect(findUnique).not.toHaveBeenCalled();
      },
    );

    it('answers 400 when there is no file', async () => {
      const res = await upload().expect(400);

      expect(res.body).toMatchObject({ statusCode: 400 });
      expect(await files()).toEqual([]);
    });

    it('answers 400 when the file comes in another field', async () => {
      await upload().attach('photo', png(), 'cover.png').expect(400);

      expect(await files()).toEqual([]);
    });

    it('answers 400 for more than one file', async () => {
      await upload()
        .attach('image', png(), 'a.png')
        .attach('image', png(), 'b.png')
        .expect(400);

      expect(await files()).toEqual([]);
    });

    it('answers 400 when there are other form fields next to the file', async () => {
      await upload()
        .field('note', 'hello')
        .attach('image', png(), 'cover.png')
        .expect(400);

      expect(await files()).toEqual([]);
    });

    it('answers 400 for a JSON body', async () => {
      await upload().send({ image: 'data:image/png;base64,AAAA' }).expect(400);

      expect(await files()).toEqual([]);
    });

    it('answers 404 and leaves nothing on disk when the book does not exist or is deleted', async () => {
      findUnique.mockResolvedValue(null);

      const res = await upload()
        .attach('image', png(), 'cover.png')
        .expect(404);

      expect(res.body).toMatchObject({ message: 'Book not found' });
      expect(await files()).toEqual([]);
    });

    it('answers 400 when the id is not a UUID', async () => {
      await upload('not-a-uuid')
        .attach('image', png(), 'cover.png')
        .expect(400);

      expect(await files()).toEqual([]);
      expect(findUnique).not.toHaveBeenCalled();
    });

    it('replaces the cover and deletes the previous file', async () => {
      const oldName = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d.jpg';
      await writeFile(join(uploadDir, oldName), jpeg());
      findUnique.mockResolvedValue(bookRow(`/api/uploads/${oldName}`));

      const res = await upload().attach('image', png(), 'new.png').expect(200);

      const stored = await files();
      expect(stored).toHaveLength(1);
      expect(stored).not.toContain(oldName);
      expect((res.body as { data: { imageUrl: string } }).data.imageUrl).toBe(
        `/api/uploads/${stored[0]}`,
      );
    });

    it('does not touch files when the stored URL is not one of ours', async () => {
      const keep = '1b2c3d4e-5f60-4718-8293-a4b5c6d7e8f9.png';
      await writeFile(join(uploadDir, keep), png());
      findUnique.mockResolvedValue(bookRow('/api/uploads/../' + keep));

      await upload().attach('image', png(), 'new.png').expect(200);

      expect(await files()).toContain(keep);
    });

    it('removes the new file when the database fails, and answers 500 without details', async () => {
      update.mockRejectedValue(new Error('connection refused to 10.0.0.5'));

      const res = await upload()
        .attach('image', png(), 'cover.png')
        .expect(500);

      expect(await files()).toEqual([]);
      expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
    });

    it('keeps the previous file when the database fails', async () => {
      const oldName = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d.jpg';
      await writeFile(join(uploadDir, oldName), jpeg());
      findUnique.mockResolvedValue(bookRow(`/api/uploads/${oldName}`));
      update.mockRejectedValue(new Error('db down'));

      await upload().attach('image', png(), 'new.png').expect(500);

      expect(await files()).toEqual([oldName]);
    });
  });

  describe('DELETE /api/books/:id/image', () => {
    const remove = (id = ID) =>
      api().delete(`/api/books/${id}/image`).set('Authorization', auth);

    it('clears the cover and deletes the file', async () => {
      const name = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d.png';
      await writeFile(join(uploadDir, name), png());
      findUnique.mockResolvedValue(bookRow(`/api/uploads/${name}`));

      const res = await remove().expect(200);

      expect(res.body).toMatchObject({ data: { id: ID, imageUrl: null } });
      expect(await files()).toEqual([]);
    });

    it('returns a book without a cover unchanged', async () => {
      const res = await remove().expect(200);

      expect(res.body).toMatchObject({ data: { id: ID, imageUrl: null } });
      expect($transaction).not.toHaveBeenCalled();
    });

    it('answers 404 when the book does not exist or is deleted', async () => {
      findUnique.mockResolvedValue(null);

      await remove().expect(404);
    });

    it('answers 400 when the id is not a UUID', async () => {
      await remove('nope').expect(400);
    });

    it('keeps the file when the database fails', async () => {
      const name = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d.png';
      await writeFile(join(uploadDir, name), png());
      findUnique.mockResolvedValue(bookRow(`/api/uploads/${name}`));
      update.mockRejectedValue(new Error('db down'));

      await remove().expect(500);

      expect(await files()).toEqual([name]);
    });
  });
});
