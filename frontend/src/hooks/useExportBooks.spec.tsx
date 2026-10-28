import { act, renderHook, waitFor } from '@testing-library/react';
import { DEFAULT_PARAMS } from '../lib/book-list-params';
import * as download from '../lib/download-file';
import { mockApi, type MockApi } from '../test/mock-api';
import { createQueryWrapper } from '../test/query-wrapper';
import { useExportBooks } from './useExportBooks';

describe('useExportBooks', () => {
  let api: MockApi;
  const csv = new Blob(['a'], { type: 'text/csv' });

  afterEach(() => {
    api.restore();
    vi.restoreAllMocks();
  });

  it('saves the file once the server answers', async () => {
    const save = vi
      .spyOn(download, 'saveBlob')
      .mockImplementation(() => undefined);
    api = mockApi({
      'GET /books/export': {
        data: csv,
        headers: { 'content-disposition': 'attachment; filename="a.csv"' },
      },
    });
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useExportBooks(DEFAULT_PARAMS), {
      wrapper,
    });

    act(() => result.current.exportCsv());

    await waitFor(() => expect(save).toHaveBeenCalledWith(csv, 'a.csv'));
    expect(result.current.isExporting).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('starts one request even if it is called twice in a row', async () => {
    vi.spyOn(download, 'saveBlob').mockImplementation(() => undefined);
    let release: () => void = () => undefined;
    api = mockApi({
      'GET /books/export': () =>
        new Promise((resolve) => {
          release = () => resolve({ data: csv });
        }),
    });
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useExportBooks(DEFAULT_PARAMS), {
      wrapper,
    });

    act(() => result.current.exportCsv());
    await waitFor(() => expect(result.current.isExporting).toBe(true));
    act(() => result.current.exportCsv());
    release();

    await waitFor(() => expect(result.current.isExporting).toBe(false));
    expect(api.requests).toHaveLength(1);
  });

  it('exposes the error of a failed export', async () => {
    api = mockApi({ 'GET /books/export': { status: 500, data: new Blob([]) } });
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useExportBooks(DEFAULT_PARAMS), {
      wrapper,
    });

    act(() => result.current.exportCsv());

    await waitFor(() =>
      expect(result.current.error?.message).toMatch(/servidor/),
    );
  });
});
