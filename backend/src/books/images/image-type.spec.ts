import { sniffImageType } from './image-type';

const bytes = (...values: number[]) => Buffer.from(values);
/** A buffer that starts with `signature` and continues with some "image data". */
const withSignature = (signature: number[], size = 64) =>
  Buffer.concat([Buffer.from(signature), Buffer.alloc(size, 0x41)]);

const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const webp = (size = 64) =>
  Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.from([0x24, 0x00, 0x00, 0x00]),
    Buffer.from('WEBP'),
    Buffer.alloc(size, 0x41),
  ]);

describe('sniffImageType', () => {
  it('recognizes a JPEG by its signature', () => {
    expect(sniffImageType(withSignature(JPEG))).toEqual({
      mime: 'image/jpeg',
      extension: 'jpg',
    });
  });

  it.each([[[0xff, 0xd8, 0xff, 0xe1]], [[0xff, 0xd8, 0xff, 0xdb]]])(
    'recognizes JPEG variants that share the first three bytes (%j)',
    (signature) => {
      expect(sniffImageType(withSignature(signature))?.mime).toBe('image/jpeg');
    },
  );

  it('recognizes a PNG by its eight-byte signature', () => {
    expect(sniffImageType(withSignature(PNG))).toEqual({
      mime: 'image/png',
      extension: 'png',
    });
  });

  it('recognizes a WebP: RIFF, a size, then WEBP', () => {
    expect(sniffImageType(webp())).toEqual({
      mime: 'image/webp',
      extension: 'webp',
    });
  });

  it.each([
    ['an empty buffer', Buffer.alloc(0)],
    ['a single byte', bytes(0xff)],
    ['a truncated JPEG signature', bytes(0xff, 0xd8)],
    ['a truncated PNG signature', Buffer.from(PNG.slice(0, 7))],
    [
      'a PNG signature with a wrong last byte',
      Buffer.from([...PNG.slice(0, 7), 0x0b]),
    ],
    [
      'a RIFF container that is not WebP (a WAV)',
      Buffer.concat([
        Buffer.from('RIFF'),
        bytes(0, 0, 0, 0),
        Buffer.from('WAVEfmt '),
      ]),
    ],
    ['a RIFF header cut before the WEBP marker', Buffer.from('RIFF1234WEB')],
    ['text', Buffer.from('just some text')],
    [
      'HTML named like an image',
      Buffer.from('<html><script>alert(1)</script></html>'),
    ],
    ['an SVG', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
    ['a GIF', Buffer.from('GIF89a......')],
    ['a PDF', Buffer.from('%PDF-1.7 ......')],
    ['a ZIP', bytes(0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0, 0, 0)],
    [
      'a Windows executable',
      Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00'),
    ],
  ])('rejects %s', (_label, buffer) => {
    expect(sniffImageType(buffer)).toBeNull();
  });

  it('ignores what comes after the signature', () => {
    const polyglot = Buffer.concat([
      Buffer.from(PNG),
      Buffer.from('<script>alert(1)</script>'),
    ]);

    // It is a PNG as far as the signature goes; it is then served as image/png with nosniff.
    expect(sniffImageType(polyglot)?.mime).toBe('image/png');
  });

  it('does not accept a signature that is not at the start', () => {
    expect(
      sniffImageType(Buffer.concat([bytes(0x00), withSignature(PNG)])),
    ).toBeNull();
  });
});
