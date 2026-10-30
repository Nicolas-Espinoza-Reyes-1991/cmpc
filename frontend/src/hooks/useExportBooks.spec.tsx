import { act, renderHook, waitFor } from '@testing-library/react';
import { DEFAULT_PARAMS } from '../lib/book-list-params';
import * as download from '../lib/download-file';
import { mockApi, type MockApi } from '../test/mock-api';
import { createQueryWrapper } from '../test/query-wrapper';
import { useExportBooks } from './useExportBooks';

describe('useExportBooks', () => {
  let api: MockApi;
  const file = new Blob(['a']);

  const setup = () => {
    const { wrapper } = createQueryWrapper();
    return renderHook(() => useExportBooks(DEFAULT_PARAMS), { wrapper });
  };

  afterEach(() => {
    api.restore();
    vi.restoreAllMocks();
  });

  it.each([
    ['csv', 'GET /books/export', 'a.csv'],
    ['xlsx', 'GET /books/export/xlsx', 'a.xlsx'],
  ] as const)(
    'saves the %s file once the server answers',
    async (format, route, name) => {
      const save = vi
        .spyOn(download, 'saveBlob')
        .mockImplementation(() => undefined);
      api = mockApi({
        [route]: {
          data: file,
          headers: {
            'content-disposition': `attachment; filename="${name}"`,
          },
        },
      });
      const { result } = setup();

      act(() => result.current.exportFile(format));

      await waitFor(() => expect(save).toHaveBeenCalledWith(file, name));
      expect(result.current.isExporting).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.failedFormat).toBeUndefined();
    },
  );

  it('says which format is running, and none afterwards', async () => {
    vi.spyOn(download, 'saveBlob').mockImplementation(() => undefined);
    let release: () => void = () => undefined;
    api = mockApi({
      'GET /books/export/xlsx': () =>
        new Promise((resolve) => {
          release = () => resolve({ data: file });
        }),
    });
    const { result } = setup();

    expect(result.current.exportingFormat).toBeUndefined();
    act(() => result.current.exportFile('xlsx'));
    await waitFor(() => expect(result.current.exportingFormat).toBe('xlsx'));
    release();

    await waitFor(() => expect(result.current.isExporting).toBe(false));
    expect(result.current.exportingFormat).toBeUndefined();
  });

  it('starts one request even if it is called twice, also with the other format', async () => {
    vi.spyOn(download, 'saveBlob').mockImplementation(() => undefined);
    let release: () => void = () => undefined;
    api = mockApi({
      'GET /books/export/xlsx': () =>
        new Promise((resolve) => {
          release = () => resolve({ data: file });
        }),
      'GET /books/export': { data: file },
    });
    const { result } = setup();

    act(() => result.current.exportFile('xlsx'));
    await waitFor(() => expect(result.current.isExporting).toBe(true));
    act(() => result.current.exportFile('xlsx'));
    act(() => result.current.exportFile('csv'));
    release();

    await waitFor(() => expect(result.current.isExporting).toBe(false));
    expect(api.requests).toHaveLength(1);
    expect(api.requests[0]?.url).toBe('/books/export/xlsx');
  });

  it('exposes the error and the format that failed, until dismissed', async () => {
    api = mockApi({
      'GET /books/export/xlsx': { status: 500, data: new Blob([]) },
    });
    const { result } = setup();

    act(() => result.current.exportFile('xlsx'));

    await waitFor(() =>
      expect(result.current.error?.message).toMatch(/servidor/),
    );
    expect(result.current.failedFormat).toBe('xlsx');

    act(() => result.current.dismiss());

    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.failedFormat).toBeUndefined();
  });

  it('keeps no failed format while a retry is running', async () => {
    let attempts = 0;
    let release: () => void = () => undefined;
    vi.spyOn(download, 'saveBlob').mockImplementation(() => undefined);
    api = mockApi({
      'GET /books/export': () => {
        attempts += 1;
        return attempts === 1
          ? { status: 500, data: new Blob([]) }
          : new Promise((resolve) => {
              release = () => resolve({ data: file });
            });
      },
    });
    const { result } = setup();

    act(() => result.current.exportFile('csv'));
    await waitFor(() => expect(result.current.failedFormat).toBe('csv'));
    act(() => result.current.exportFile('csv'));

    await waitFor(() => expect(result.current.exportingFormat).toBe('csv'));
    expect(result.current.failedFormat).toBeUndefined();
    release();
    await waitFor(() => expect(result.current.isExporting).toBe(false));
  });
});
