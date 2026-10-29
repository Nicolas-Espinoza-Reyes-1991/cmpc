export interface ImageType {
  mime: 'image/jpeg' | 'image/png' | 'image/webp';
  /** Extension the file is stored with, decided by the content and not by the client. */
  extension: 'jpg' | 'png' | 'webp';
}

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
// WebP is a RIFF container: "RIFF", four bytes of size, then "WEBP".
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];
const WEBP_MARKER_OFFSET = 8;

const startsWith = (
  buffer: Buffer,
  signature: readonly number[],
  offset = 0,
): boolean =>
  buffer.length >= offset + signature.length &&
  signature.every((byte, index) => buffer[offset + index] === byte);

/**
 * What an uploaded file really is, read from its first bytes. The name, the
 * extension and the `Content-Type` come from the client and prove nothing: a
 * page of HTML can be called `cover.png`. Only JPEG, PNG and WebP are accepted
 * (SVG is not: it can carry scripts). Returns `null` for anything else.
 */
export function sniffImageType(buffer: Buffer): ImageType | null {
  if (startsWith(buffer, JPEG_SIGNATURE)) {
    return { mime: 'image/jpeg', extension: 'jpg' };
  }
  if (startsWith(buffer, PNG_SIGNATURE)) {
    return { mime: 'image/png', extension: 'png' };
  }
  if (
    startsWith(buffer, RIFF) &&
    startsWith(buffer, WEBP, WEBP_MARKER_OFFSET)
  ) {
    return { mime: 'image/webp', extension: 'webp' };
  }
  return null;
}
