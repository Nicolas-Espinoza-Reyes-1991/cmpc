import { deflateRawSync } from 'node:zlib';
import { readXlsx } from './xlsx-reader.helper-spec';

/** A minimal zip with the given entries, to test the reader on known bytes. */
function zip(
  entries: { name: string; text: string }[],
  method: 0 | 8 | 12 = 0,
): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const { name, text } of entries) {
    const raw = Buffer.from(text, 'utf8');
    const data = method === 8 ? deflateRawSync(raw) : raw;
    const nameBuffer = Buffer.from(name, 'utf8');

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    locals.push(local, nameBuffer, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuffer);

    offset += local.length + nameBuffer.length + data.length;
  }

  const centralDirectory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralDirectory, end]);
}

describe('readXlsx (test helper)', () => {
  const entries = [
    { name: 'a.xml', text: '<a>ñ</a>' },
    { name: 'dir/b.xml', text: '<b/>' },
  ];

  it('reads stored entries by name', () => {
    expect(readXlsx(zip(entries))).toEqual({
      'a.xml': '<a>ñ</a>',
      'dir/b.xml': '<b/>',
    });
  });

  it('reads deflated entries by name', () => {
    expect(readXlsx(zip(entries, 8))).toEqual({
      'a.xml': '<a>ñ</a>',
      'dir/b.xml': '<b/>',
    });
  });

  it('rejects something that is not a zip file', () => {
    expect(() =>
      readXlsx(Buffer.from('plain text, definitely not a zip')),
    ).toThrow('Not a zip file');
  });

  it('rejects a corrupt central directory', () => {
    const file = zip(entries);
    // The end record says where the directory starts: break its signature.
    const start = file.readUInt32LE(file.length - 22 + 16);
    file.writeUInt32LE(0, start);

    expect(() => readXlsx(file)).toThrow('Corrupt central directory');
  });

  it('rejects a compression method it does not know', () => {
    expect(() => readXlsx(zip(entries, 12))).toThrow(
      'Unsupported compression method 12',
    );
  });
});
