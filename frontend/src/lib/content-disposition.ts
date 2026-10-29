const FALLBACK_NAME = 'libros.csv';

/**
 * The file name the server proposes in `Content-Disposition`. It is only a
 * name: path parts and control characters are dropped so a header can never
 * point outside the downloads folder, and a missing or empty one falls back to
 * a fixed name.
 */
export function fileNameFromDisposition(
  header: string | undefined,
  fallback: string = FALLBACK_NAME,
): string {
  // Quoted form first, then the bare token (`filename=libros.csv`).
  const match =
    /filename\s*=\s*"([^"]*)"/i.exec(header ?? '') ??
    /filename\s*=\s*([^;\s]+)/i.exec(header ?? '');
  const raw = match?.[1] ?? '';

  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  const name = raw.replace(/[\u0000-\u001f\u007f]/g, '');
  // Everything after the last separator (the whole name when there is none).
  const lastPart = name.slice(name.search(/[^/\\]*$/)).trim();

  // `..` and `.` are not file names.
  return lastPart === '' || /^\.+$/.test(lastPart) ? fallback : lastPart;
}
