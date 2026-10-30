import { coverFileName } from '../lib/cover-file-name';

interface CoverDownloadProps {
  /** The cover file (`imageUrl` of the book). */
  src: string;
  title: string;
}

/**
 * A link with the `download` attribute: the cover is public (`/api/uploads`),
 * so the browser fetches it directly and no request needs the token.
 */
export function CoverDownload({ src, title }: CoverDownloadProps) {
  return (
    <a
      href={src}
      download={coverFileName(title, src)}
      className="flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-100 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700"
    >
      Descargar portada
    </a>
  );
}
