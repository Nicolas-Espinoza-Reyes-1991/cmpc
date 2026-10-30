import { coverFileName } from '../lib/cover-file-name';
import type { CoverSize } from './CoverPreview';

interface CoverDownloadProps {
  /** The cover file (`imageUrl` of the book). */
  src: string;
  title: string;
  /** The book page by default; `row` is the compact button of the listing. */
  size?: CoverSize;
}

const STYLES: Record<CoverSize, string> = {
  detail:
    'flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-100 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700',
  // At least 44 px tall to touch on a phone; compact from 640 px.
  row: 'inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700 sm:min-h-0',
};

/**
 * A link with the `download` attribute: the cover is public (`/api/uploads`),
 * so the browser fetches it directly and no request needs the token. In a row
 * of the listing the visible text is short, so the title goes in the name that
 * a screen reader announces: there are many of these buttons on the page.
 */
export function CoverDownload({
  src,
  title,
  size = 'detail',
}: CoverDownloadProps) {
  return (
    <a
      href={src}
      download={coverFileName(title, src)}
      aria-label={size === 'row' ? `Descargar portada de ${title}` : undefined}
      className={STYLES[size]}
    >
      {size === 'row' ? 'Descargar' : 'Descargar portada'}
    </a>
  );
}
