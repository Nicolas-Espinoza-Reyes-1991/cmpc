/** The largest cover the API accepts: 2 MB. The server enforces it too. */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** The formats the API accepts, as the browser names them. */
export const IMAGE_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

/** Value of the `accept` attribute: the file dialog shows only these. */
export const IMAGE_ACCEPT = IMAGE_TYPES.join(',');

export const IMAGE_TYPE_MESSAGE =
  'La portada debe ser una imagen JPG, PNG o WebP.';
export const IMAGE_SIZE_MESSAGE = 'La portada no puede pesar más de 2 MB.';
export const IMAGE_EMPTY_MESSAGE = 'El archivo de la portada está vacío.';

/**
 * Checks a chosen cover before anything is sent, so the user hears about it at
 * once and no bandwidth is spent. `file.type` comes from the file extension, so
 * this is a convenience and not a guarantee: the server decides by the content
 * of the file and repeats every check. Returns the message, or `null` if fine.
 */
export function validateImageFile(
  file: Pick<File, 'type' | 'size'>,
): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return IMAGE_TYPE_MESSAGE;
  if (file.size === 0) return IMAGE_EMPTY_MESSAGE;
  if (file.size > MAX_IMAGE_BYTES) return IMAGE_SIZE_MESSAGE;
  return null;
}
