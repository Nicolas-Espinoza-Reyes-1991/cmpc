import { saveBlob } from './download-file';

describe('saveBlob', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('clicks a temporary link to the file with its name and removes it', () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    let clicked:
      | { href: string | null; download: string; inDocument: boolean }
      | undefined;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      function click(this: HTMLAnchorElement) {
        // Some browsers only honour the click when the link is in the document.
        clicked = {
          href: this.getAttribute('href'),
          download: this.download,
          inDocument: document.body.contains(this),
        };
      },
    );
    const blob = new Blob(['a'], { type: 'text/csv' });

    saveBlob(blob, 'libros.csv');

    expect(create).toHaveBeenCalledWith(blob);
    expect(clicked).toEqual({
      href: 'blob:x',
      download: 'libros.csv',
      inDocument: true,
    });
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('releases the object URL after the click, not before', () => {
    vi.useFakeTimers();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:y');
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined,
    );

    saveBlob(new Blob(['a']), 'a.csv');
    expect(revoke).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:y');
  });
});
