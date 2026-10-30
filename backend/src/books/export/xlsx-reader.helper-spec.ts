import { inflateRawSync } from 'node:zlib';

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50;
const STORED = 0;
const DEFLATED = 8;

/**
 * Opens an `.xlsx` (a zip file) and returns the text of every part by name, so
 * the tests can check what is really inside the file without another
 * dependency. Only what the writer produces is supported: stored or deflated
 * entries, no encryption and no zip64.
 */
export function readXlsx(file: Buffer): Record<string, string> {
  let end = file.length - 22;
  while (end >= 0 && file.readUInt32LE(end) !== END_OF_CENTRAL_DIRECTORY) {
    end -= 1;
  }
  if (end < 0) throw new Error('Not a zip file');

  const entries = file.readUInt16LE(end + 10);
  let position = file.readUInt32LE(end + 16);
  const parts: Record<string, string> = {};

  for (let index = 0; index < entries; index += 1) {
    if (file.readUInt32LE(position) !== CENTRAL_DIRECTORY_ENTRY) {
      throw new Error('Corrupt central directory');
    }
    const method = file.readUInt16LE(position + 10);
    const compressedSize = file.readUInt32LE(position + 20);
    const nameLength = file.readUInt16LE(position + 28);
    const extraLength = file.readUInt16LE(position + 30);
    const commentLength = file.readUInt16LE(position + 32);
    const localHeader = file.readUInt32LE(position + 42);
    const name = file.toString(
      'utf8',
      position + 46,
      position + 46 + nameLength,
    );

    // The local header repeats the name and has its own extra field.
    const dataStart =
      localHeader +
      30 +
      file.readUInt16LE(localHeader + 26) +
      file.readUInt16LE(localHeader + 28);
    const data = file.subarray(dataStart, dataStart + compressedSize);
    if (method !== STORED && method !== DEFLATED) {
      throw new Error(`Unsupported compression method ${method}`);
    }
    parts[name] = (method === DEFLATED ? inflateRawSync(data) : data).toString(
      'utf8',
    );

    position += 46 + nameLength + extraLength + commentLength;
  }
  return parts;
}
