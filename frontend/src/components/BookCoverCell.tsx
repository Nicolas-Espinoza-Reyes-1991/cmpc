import { CoverPreview } from './CoverPreview';

interface BookCoverCellProps {
  title: string;
  /** The cover to show; `null` when the book has none or its file did not load. */
  imageUrl: string | null;
  /** The book has a cover but its file did not load (it says so to screen readers). */
  broken: boolean;
  /** Called with the URL of the file when it fails to load. */
  onError: (imageUrl: string) => void;
}

/**
 * The first cell of a row of the listing: the cover as a small thumbnail that
 * opens at full size, or a marker of the same size, so the rows keep their
 * height whether or not there is a picture.
 */
export function BookCoverCell({
  title,
  imageUrl,
  broken,
  onError,
}: BookCoverCellProps) {
  if (imageUrl) {
    return (
      <CoverPreview
        src={imageUrl}
        title={title}
        onError={() => onError(imageUrl)}
        size="row"
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={
        broken
          ? `La portada de ${title} no se pudo cargar`
          : `${title} todavía no tiene portada`
      }
      className="flex h-[72px] w-12 shrink-0 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-100 px-1 text-center text-[10px] leading-tight text-slate-500"
    >
      Sin portada
    </div>
  );
}
