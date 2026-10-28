import { act, renderHook, waitFor } from '@testing-library/react';
import { mockApi, type MockApi } from '../test/mock-api';
import { createQueryWrapper } from '../test/query-wrapper';
import { useCatalogOptions } from './useCatalogOptions';

const names = (data: { name: string }[] | undefined) =>
  data?.map((item) => item.name);

describe('useCatalogOptions', () => {
  let api: MockApi;

  afterEach(() => {
    vi.useRealTimers();
    api.restore();
  });

  it('loads the first suggestions right away', async () => {
    api = mockApi({
      'GET /publishers': { data: { data: [{ id: 'p1', name: 'Planeta' }] } },
    });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useCatalogOptions('publishers', ''), {
      wrapper,
    });

    await waitFor(() =>
      expect(names(result.current.data)).toEqual(['Planeta']),
    );
    expect(api.requests[0]?.params).toEqual({ search: undefined, limit: 10 });
  });

  it('waits for the user to stop typing before searching', async () => {
    api = mockApi({
      'GET /authors': (config) => ({
        data: {
          data: [
            {
              id: 'a1',
              name: (config.params as { search?: string }).search ?? 'todos',
            },
          ],
        },
      }),
    });
    // The clock also ticks by itself, so TanStack Query's own timers keep working.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { wrapper } = createQueryWrapper();
    const { result, rerender } = renderHook(
      ({ text }) => useCatalogOptions('authors', text),
      { wrapper, initialProps: { text: '' } },
    );
    await waitFor(() => expect(names(result.current.data)).toEqual(['todos']));

    rerender({ text: 'is' });
    rerender({ text: 'isab' });
    expect(api.requests).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    await waitFor(() => expect(names(result.current.data)).toEqual(['isab']));
    expect(api.requests).toHaveLength(2);
  });

  it('trims the text before searching', async () => {
    api = mockApi({ 'GET /genres': { data: { data: [] } } });
    const { wrapper } = createQueryWrapper();

    renderHook(() => useCatalogOptions('genres', '   '), { wrapper });

    await waitFor(() => expect(api.requests).toHaveLength(1));
    expect(api.requests[0]?.params).toEqual({ search: undefined, limit: 10 });
  });

  it('only means no suggestions when the request fails, without the global notice', async () => {
    api = mockApi({ 'GET /genres': { status: 500, data: {} } });
    const { wrapper, queryClient } = createQueryWrapper();

    const { result } = renderHook(() => useCatalogOptions('genres', ''), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
    expect(
      queryClient.getQueryCache().find({ queryKey: ['catalog', 'genres', ''] })
        ?.meta,
    ).toEqual({ silent: true });
  });
});
