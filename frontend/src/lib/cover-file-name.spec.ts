import { coverFileName } from './cover-file-name';

describe('coverFileName', () => {
  it('uses the title in lowercase, without accents, with dashes', () => {
    expect(coverFileName('Cien años de soledad', '/uploads/abc.png')).toBe(
      'cien-anos-de-soledad.png',
    );
  });

  it('drops symbols and repeated separators', () => {
    expect(coverFileName('  ¿Qué?  Dune: 2!! ', '/uploads/abc.jpg')).toBe(
      'que-dune-2.jpg',
    );
  });

  it('keeps the extension of the stored file, in lowercase', () => {
    expect(coverFileName('Dune', '/api/uploads/9f.WEBP')).toBe('dune.webp');
    expect(coverFileName('Dune', '/api/uploads/9f.jpeg')).toBe('dune.jpeg');
  });

  it('never uses the stored name', () => {
    const name = coverFileName('Dune', '/api/uploads/3f6c2a52-7f0e.png');
    expect(name).toBe('dune.png');
    expect(name).not.toContain('3f6c2a52');
  });

  it('falls back to "portada" when the title has no letters or digits', () => {
    expect(coverFileName('¿¡?!', '/uploads/abc.png')).toBe('portada.png');
    expect(coverFileName('', '/uploads/abc.png')).toBe('portada.png');
  });

  it('leaves the extension out when the stored file has none it knows', () => {
    expect(coverFileName('Dune', '/uploads/abc.gif')).toBe('dune');
  });
});
