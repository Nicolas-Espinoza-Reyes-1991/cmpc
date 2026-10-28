import {
  IMAGE_ACCEPT,
  IMAGE_EMPTY_MESSAGE,
  IMAGE_SIZE_MESSAGE,
  IMAGE_TYPE_MESSAGE,
  MAX_IMAGE_BYTES,
  validateImageFile,
} from './image-file';

const file = (type: string, size: number) => ({ type, size });

describe('validateImageFile', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp'])('accepts a %s', (type) => {
    expect(validateImageFile(file(type, 1000))).toBeNull();
  });

  it.each([
    ['a GIF', 'image/gif'],
    ['an SVG', 'image/svg+xml'],
    ['a PDF', 'application/pdf'],
    ['plain text', 'text/plain'],
    ['a file with no type', ''],
    ['a type with other case', 'IMAGE/PNG'],
  ])('rejects %s with the message about formats', (_label, type) => {
    expect(validateImageFile(file(type, 1000))).toBe(IMAGE_TYPE_MESSAGE);
  });

  it('accepts exactly 2 MB and rejects one byte more', () => {
    expect(validateImageFile(file('image/png', MAX_IMAGE_BYTES))).toBeNull();
    expect(validateImageFile(file('image/png', MAX_IMAGE_BYTES + 1))).toBe(
      IMAGE_SIZE_MESSAGE,
    );
  });

  it('accepts a single byte and rejects an empty file', () => {
    expect(validateImageFile(file('image/png', 1))).toBeNull();
    expect(validateImageFile(file('image/png', 0))).toBe(IMAGE_EMPTY_MESSAGE);
  });

  it('reports the format first when the file is wrong in both ways', () => {
    expect(validateImageFile(file('image/gif', MAX_IMAGE_BYTES + 1))).toBe(
      IMAGE_TYPE_MESSAGE,
    );
  });

  it('says what is wrong in Spanish', () => {
    expect(IMAGE_TYPE_MESSAGE).toBe(
      'La portada debe ser una imagen JPG, PNG o WebP.',
    );
    expect(IMAGE_SIZE_MESSAGE).toBe('La portada no puede pesar más de 2 MB.');
  });

  it('offers the same formats to the file dialog', () => {
    expect(IMAGE_ACCEPT).toBe('image/jpeg,image/png,image/webp');
  });

  it('mirrors the limit of the API: 2 MB', () => {
    expect(MAX_IMAGE_BYTES).toBe(2 * 1024 * 1024);
  });
});
