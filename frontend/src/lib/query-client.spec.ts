import { ApiError } from './api-error';
import { createQueryClient, shouldRetry } from './query-client';

describe('shouldRetry', () => {
  it.each([
    ['a network failure', 0, new ApiError(0, 'x'), true],
    ['a server error', 0, new ApiError(500, 'x'), true],
    ['an unknown error', 0, new Error('boom'), true],
    ['a not found', 0, new ApiError(404, 'x'), false],
    ['a validation error', 0, new ApiError(400, 'x'), false],
    ['a rate limit', 0, new ApiError(429, 'x'), false],
    [
      'a server error that already failed once',
      1,
      new ApiError(500, 'x'),
      false,
    ],
  ])('for %s', (_label, failureCount, error, expected) => {
    expect(shouldRetry(failureCount, error)).toBe(expected);
  });
});

describe('createQueryClient', () => {
  it('uses the retry policy and does not refetch on window focus', () => {
    const defaults = createQueryClient(vi.fn()).getDefaultOptions();

    expect(defaults.queries?.retry).toBe(shouldRetry);
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
  });

  it('never retries mutations, which are not idempotent', () => {
    const defaults = createQueryClient(vi.fn()).getDefaultOptions();

    expect(defaults.mutations?.retry).toBe(false);
  });

  it('reports a failed query', async () => {
    const onError = vi.fn();
    const failure = new ApiError(500, 'x');

    await createQueryClient(onError)
      .fetchQuery({
        queryKey: ['a'],
        queryFn: () => Promise.reject(failure),
        retry: false,
      })
      .catch(() => undefined);

    expect(onError).toHaveBeenCalledWith(failure);
  });

  it('stays quiet about a silent query', async () => {
    const onError = vi.fn();

    await createQueryClient(onError)
      .fetchQuery({
        queryKey: ['b'],
        queryFn: () => Promise.reject(new ApiError(500, 'x')),
        retry: false,
        meta: { silent: true },
      })
      .catch(() => undefined);

    expect(onError).not.toHaveBeenCalled();
  });
});
