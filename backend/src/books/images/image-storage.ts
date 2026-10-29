import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { EnvironmentVariables } from '../../config/env.validation';
import type { ImageType } from './image-type';

/** Where the stored images are served (under the API prefix, so nginx forwards it). */
export const UPLOADS_ROUTE = '/api/uploads';

/**
 * The name of every stored file: a UUID the server made plus the extension the
 * content decided. Checking it before touching the disk means a value read
 * from the database can never point outside the upload directory.
 */
const STORED_NAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

type Config = Pick<ConfigService<EnvironmentVariables, true>, 'get'>;

/** The absolute upload directory of `UPLOAD_DIR`, the same for storing and serving. */
export const uploadDirectory = (config: Config): string =>
  resolve(config.get('UPLOAD_DIR', { infer: true }));

/**
 * The only place that touches the image files. Names are made here, never taken
 * from the client; everything else (the type, the size, the book) is decided
 * before `save` is called.
 */
@Injectable()
export class ImageStorage implements OnModuleInit {
  private readonly logger = new Logger(ImageStorage.name);
  private readonly directory: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.directory = uploadDirectory(config);
  }

  /** The directory must exist before the first upload (a fresh volume is empty). */
  async onModuleInit(): Promise<void> {
    await mkdir(this.directory, { recursive: true });
  }

  /** Writes the bytes under a new unique name and returns that name. */
  async save(
    buffer: Buffer,
    extension: ImageType['extension'],
  ): Promise<string> {
    const name = `${randomUUID()}.${extension}`;
    // `wx` fails instead of overwriting: a name is never reused.
    await writeFile(join(this.directory, name), buffer, { flag: 'wx' });
    return name;
  }

  /**
   * Deletes a stored file. It never throws: by the time it is called the book
   * is already updated, so a file that cannot be deleted is only logged (it
   * would be an unreferenced file, not a broken book).
   */
  async remove(name: string): Promise<void> {
    if (!STORED_NAME.test(name)) {
      this.logger.warn(
        `Refusing to delete a file with an unexpected name: ${name}`,
      );
      return;
    }
    try {
      await unlink(join(this.directory, name));
    } catch (error) {
      // `catch` types the error as `unknown`; a failed `unlink` always rejects with
      // a Node system error, which is the one that carries `code`.
      const code = (error as NodeJS.ErrnoException).code;
      // Already gone is fine; anything else (permissions, disk) is worth a warning.
      if (code !== 'ENOENT') {
        this.logger.warn(
          `Could not delete the image ${name}: ${String(error)}`,
        );
      }
    }
  }

  urlFor(name: string): string {
    return `${UPLOADS_ROUTE}/${name}`;
  }

  /** The stored file name behind an `imageUrl`, or `null` if it is not one of ours. */
  nameFromUrl(url: string | null): string | null {
    if (!url?.startsWith(`${UPLOADS_ROUTE}/`)) return null;
    const name = url.slice(UPLOADS_ROUTE.length + 1);
    return STORED_NAME.test(name) ? name : null;
  }
}
