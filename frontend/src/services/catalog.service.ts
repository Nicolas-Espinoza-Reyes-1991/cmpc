import { apiClient } from '../lib/api-client';
import type { ApiResponse } from '../types/api';
import type { CatalogItem, CatalogKind } from '../types/book';

export interface CatalogQuery {
  /** Text contained in the name; empty means no filter. */
  search?: string;
  limit?: number;
}

/** Names of one catalog, ordered by name, for suggestions and filters. */
export async function listCatalog(
  kind: CatalogKind,
  { search, limit }: CatalogQuery = {},
  signal?: AbortSignal,
): Promise<CatalogItem[]> {
  const response = await apiClient.get<ApiResponse<CatalogItem[]>>(`/${kind}`, {
    // An empty search is left out: the API would accept it, but it adds nothing.
    params: { search: search || undefined, limit },
    signal,
  });
  return response.data.data;
}
