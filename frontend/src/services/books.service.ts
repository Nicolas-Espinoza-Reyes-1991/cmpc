import { apiClient } from '../lib/api-client';
import { ApiError } from '../lib/api-error';
import { toApiQuery, toExportQuery } from '../lib/book-list-params';
import { fileNameFromDisposition } from '../lib/content-disposition';
import type { ApiResponse } from '../types/api';
import type {
  Book,
  BookChanges,
  BookInput,
  BookListParams,
  Page,
} from '../types/book';

/** Registers a book; the API creates the author, publisher and genre if they are new. */
export async function createBook(input: BookInput): Promise<Book> {
  const response = await apiClient.post<ApiResponse<Book>>('/books', input);
  return response.data.data;
}

/** `signal` lets TanStack Query cancel the request when the screen goes away. */
export async function getBook(id: string, signal?: AbortSignal): Promise<Book> {
  const response = await apiClient.get<ApiResponse<Book>>(
    `/books/${encodeURIComponent(id)}`,
    { signal },
  );
  return response.data.data;
}

/** Sends only the fields to change. */
export async function updateBook(
  id: string,
  changes: BookChanges,
): Promise<Book> {
  const response = await apiClient.patch<ApiResponse<Book>>(
    `/books/${encodeURIComponent(id)}`,
    changes,
  );
  return response.data.data;
}

/** Soft delete: the API answers 204 with no body. */
export async function deleteBook(id: string): Promise<void> {
  await apiClient.delete(`/books/${encodeURIComponent(id)}`);
}

/** One page of books for a view of the listing; the totals come in `meta`. */
export async function listBooks(
  params: BookListParams,
  signal?: AbortSignal,
): Promise<Page<Book>> {
  const response = await apiClient.get<ApiResponse<Book[]>>('/books', {
    params: toApiQuery(params),
    signal,
  });
  const { data, meta } = response.data;
  // The API always sends `meta` with a listing; the type says it is optional for other responses.
  return {
    items: data,
    meta: meta ?? {
      page: params.page,
      limit: params.limit,
      total: data.length,
    },
  };
}

/**
 * Sets or replaces the cover. The body is `multipart/form-data` with the file
 * in the field `image`; no `Content-Type` is set here so the browser adds the
 * `boundary` it needs. Resolves with the book pointing at the new image.
 */
export async function uploadBookImage(id: string, file: File): Promise<Book> {
  const body = new FormData();
  body.append('image', file);
  const response = await apiClient.post<ApiResponse<Book>>(
    `/books/${encodeURIComponent(id)}/image`,
    body,
  );
  return response.data.data;
}

/** Removes the cover. A book without one is returned unchanged. */
export async function deleteBookImage(id: string): Promise<Book> {
  const response = await apiClient.delete<ApiResponse<Book>>(
    `/books/${encodeURIComponent(id)}/image`,
  );
  return response.data.data;
}

/**
 * A big export takes minutes (300,000 books took one to five in the
 * measurements), far more than the 15 s every other request gets.
 */
export const EXPORT_TIMEOUT_MS = 10 * 60_000;

export interface ExportedFile {
  blob: Blob;
  fileName: string;
}

export type ExportFormat = 'csv' | 'xlsx';

/**
 * The Excel is built in memory by the API, which refuses more than this many
 * books (422). The number is the API's `XLSX_MAX_ROWS`; it is repeated here only
 * to word the notice, because the body of an error whose answer was asked as a
 * `Blob` cannot be read.
 */
export const XLSX_MAX_ROWS = 20_000;

export const XLSX_TOO_MANY_MESSAGE = `Hay demasiados libros para Excel (máximo ${XLSX_MAX_ROWS.toLocaleString('es-CL')}). Aplica filtros o descarga el CSV.`;

const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const EXPORTS = {
  csv: {
    path: '/books/export',
    accept: 'text/csv',
    fallbackName: 'libros.csv',
  },
  xlsx: {
    path: '/books/export/xlsx',
    accept: XLSX_CONTENT_TYPE,
    fallbackName: 'libros.xlsx',
  },
} as const satisfies Record<
  ExportFormat,
  { path: string; accept: string; fallbackName: string }
>;

/**
 * Every book that matches the filters and the order of the view, as a file of
 * the given format. The page is not sent: the file is not paginated.
 * `Authorization` travels in the header, which is why this is a request and not
 * a link.
 */
async function exportBooks(
  format: ExportFormat,
  params: BookListParams,
): Promise<ExportedFile> {
  const { path, accept, fallbackName } = EXPORTS[format];
  const response = await apiClient.get<Blob>(path, {
    params: toExportQuery(params),
    responseType: 'blob',
    timeout: EXPORT_TIMEOUT_MS,
    headers: { Accept: accept },
  });
  return {
    blob: response.data,
    fileName: fileNameFromDisposition(
      // Axios types headers as `any`-ish values; a header is a string or absent.
      response.headers['content-disposition'] as string | undefined,
      fallbackName,
    ),
  };
}

export const exportBooksCsv = (params: BookListParams): Promise<ExportedFile> =>
  exportBooks('csv', params);

/** Same, as an Excel file. A 422 means too many books: it gets its own notice. */
export async function exportBooksXlsx(
  params: BookListParams,
): Promise<ExportedFile> {
  try {
    return await exportBooks('xlsx', params);
  } catch (error) {
    if (error instanceof ApiError && error.status === 422) {
      throw new ApiError(
        422,
        XLSX_TOO_MANY_MESSAGE,
        error.fieldErrors,
        error.serverMessage,
      );
    }
    throw error;
  }
}

/** The export of the chosen format. */
export const exportBooksAs = (
  format: ExportFormat,
  params: BookListParams,
): Promise<ExportedFile> =>
  format === 'xlsx' ? exportBooksXlsx(params) : exportBooksCsv(params);
