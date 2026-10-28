/** The largest cover accepted: 2 MB (conventions.md). */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** The form field that carries the file. */
export const IMAGE_FIELD = 'image';

/**
 * Limits applied by multer while it reads the request, so an oversized upload
 * is cut as soon as it passes the limit instead of being loaded first. Without
 * a `storage` option multer keeps the (small) file in memory, where it is
 * checked before anything is written to disk. One file, no other fields.
 */
export const IMAGE_UPLOAD_LIMITS = {
  fileSize: MAX_IMAGE_BYTES,
  files: 1,
  fields: 0,
} as const;

/** The part of the file multer hands over that the service needs. */
export interface UploadedImage {
  buffer: Buffer;
}
