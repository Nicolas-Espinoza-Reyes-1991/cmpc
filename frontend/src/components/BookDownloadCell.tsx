import { CoverDownload } from './CoverDownload';

interface BookDownloadCellProps {
  title: string;
  /** The cover that is on screen; `null` when there is none or it did not load. */
  imageUrl: string | null;
}

/**
 * The last cell of a row of the listing: the download of the cover, only when
 * there is a cover to download. Otherwise the cell is empty: a button that cannot
 * work, repeated in every row, would only be noise.
 */
export function BookDownloadCell({ title, imageUrl }: BookDownloadCellProps) {
  if (!imageUrl) return null;

  return <CoverDownload src={imageUrl} title={title} size="row" />;
}
