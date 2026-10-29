import type { MockRoute } from './mock-api';

/** The three catalog routes answering "no suggestions", for tests that only mount a book form. */
export const emptyCatalogs: Record<string, MockRoute> = {
  'GET /authors': { data: { data: [] } },
  'GET /publishers': { data: { data: [] } },
  'GET /genres': { data: { data: [] } },
};
