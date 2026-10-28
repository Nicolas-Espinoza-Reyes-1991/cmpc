import { mockApi, type MockApi } from '../test/mock-api';
import { listCatalog } from './catalog.service';

const items = [{ id: 'c1', name: 'Planeta' }];

describe('catalog service', () => {
  let api: MockApi;

  afterEach(() => {
    api.restore();
  });

  it.each(['authors', 'publishers', 'genres'] as const)(
    'reads the %s route and unwraps the items',
    async (kind) => {
      api = mockApi({ [`GET /${kind}`]: { data: { data: items } } });

      await expect(listCatalog(kind)).resolves.toEqual(items);

      expect(api.requests).toHaveLength(1);
    },
  );

  it('sends the search and the limit as query parameters', async () => {
    api = mockApi({ 'GET /publishers': { data: { data: items } } });

    await listCatalog('publishers', { search: 'plan', limit: 10 });

    expect(api.requests[0]?.params).toEqual({ search: 'plan', limit: 10 });
  });

  it('leaves an empty search out of the request', async () => {
    api = mockApi({ 'GET /genres': { data: { data: items } } });

    await listCatalog('genres', { search: '', limit: 10 });

    expect(api.requests[0]?.params).toEqual({ search: undefined, limit: 10 });
  });

  it('passes the cancellation signal to the request', async () => {
    api = mockApi({ 'GET /authors': { data: { data: items } } });
    const controller = new AbortController();

    await listCatalog('authors', {}, controller.signal);

    expect(api.requests[0]?.signal).toBe(controller.signal);
  });

  it('rejects when the request fails', async () => {
    api = mockApi({ 'GET /authors': { status: 500, data: {} } });

    await expect(listCatalog('authors')).rejects.toMatchObject({ status: 500 });
  });
});
