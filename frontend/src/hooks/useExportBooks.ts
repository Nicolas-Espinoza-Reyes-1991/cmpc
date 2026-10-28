import { useMutation } from '@tanstack/react-query';
import { saveBlob } from '../lib/download-file';
import { exportBooksCsv } from '../services/books.service';
import type { BookListParams } from '../types/book';

/**
 * Downloads the CSV of the view (filters and order, every page). While one
 * export runs a second call is ignored, so a double click does not start two
 * downloads of the same file.
 */
export function useExportBooks(params: BookListParams) {
  const mutation = useMutation({
    mutationFn: () => exportBooksCsv(params),
    // The page shows the error next to the button, with a retry.
    meta: { silent: true },
    onSuccess: ({ blob, fileName }) => saveBlob(blob, fileName),
  });

  return {
    exportCsv: () => {
      if (!mutation.isPending) mutation.mutate();
    },
    isExporting: mutation.isPending,
    error: mutation.error,
  };
}
