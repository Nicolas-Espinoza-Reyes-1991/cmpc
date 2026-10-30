import { useMutation } from '@tanstack/react-query';
import { saveBlob } from '../lib/download-file';
import { exportBooksAs, type ExportFormat } from '../services/books.service';
import type { BookListParams } from '../types/book';

/**
 * Downloads the view (filters and order, every page) as a CSV or an Excel file.
 * While one export runs, a second call of either format is ignored, so a double
 * click does not start two downloads.
 */
export function useExportBooks(params: BookListParams) {
  const mutation = useMutation({
    mutationFn: (format: ExportFormat) => exportBooksAs(format, params),
    // The page shows the error next to the buttons, with a retry.
    meta: { silent: true },
    onSuccess: ({ blob, fileName }) => saveBlob(blob, fileName),
  });

  return {
    exportFile: (format: ExportFormat) => {
      if (!mutation.isPending) mutation.mutate(format);
    },
    isExporting: mutation.isPending,
    /** The format of the export that is running, or `undefined`. */
    exportingFormat: mutation.isPending ? mutation.variables : undefined,
    /** The format that failed, with its error, until the next try or `dismiss`. */
    failedFormat: mutation.isError ? mutation.variables : undefined,
    error: mutation.error,
    dismiss: mutation.reset,
  };
}
