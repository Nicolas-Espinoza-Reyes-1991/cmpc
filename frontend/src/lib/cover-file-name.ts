/** The name a cover is saved under when the user downloads it. */
const FALLBACK_BASE = 'portada';

/**
 * `"Dune"` + `/uploads/3f6c….png` → `dune.png`: the title in lowercase ASCII
 * with dashes, and the extension of the stored file. The stored name is a
 * UUID, so it is never used as the download name.
 */
export function coverFileName(title: string, imageUrl: string): string {
  const base =
    title
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || FALLBACK_BASE;
  const extension = /\.(jpe?g|png|webp)$/i.exec(imageUrl)?.[1];
  return extension ? `${base}.${extension.toLowerCase()}` : base;
}
