import { fileNameFromDisposition } from './content-disposition';

describe('fileNameFromDisposition', () => {
  it('reads the quoted name', () => {
    expect(
      fileNameFromDisposition('attachment; filename="libros-2026-10-29.csv"'),
    ).toBe('libros-2026-10-29.csv');
  });

  it('reads the name without quotes', () => {
    expect(
      fileNameFromDisposition('attachment; filename=libros.csv; size=3'),
    ).toBe('libros.csv');
  });

  it('is not case sensitive about the parameter', () => {
    expect(fileNameFromDisposition('attachment; FileName="a.csv"')).toBe(
      'a.csv',
    );
  });

  it.each([
    ['a Unix path', 'attachment; filename="../../etc/passwd"', 'passwd'],
    ['a Windows path', 'attachment; filename="..\\..\\boot.ini"', 'boot.ini'],
    ['an absolute path', 'attachment; filename="/tmp/x.csv"', 'x.csv'],
    ['control characters', 'attachment; filename="a\u0000b\r\n.csv"', 'ab.csv'],
  ])('drops %s', (_label, header, expected) => {
    expect(fileNameFromDisposition(header)).toBe(expected);
  });

  it.each([
    ['no header', undefined],
    ['no filename', 'attachment'],
    ['an empty name', 'attachment; filename=""'],
    ['only dots', 'attachment; filename=".."'],
    ['a name that is only a folder', 'attachment; filename="folder/"'],
  ])('falls back with %s', (_label, header) => {
    expect(fileNameFromDisposition(header)).toBe('libros.csv');
  });

  it('uses the fallback it is given', () => {
    expect(fileNameFromDisposition(undefined, 'otro.csv')).toBe('otro.csv');
  });
});
