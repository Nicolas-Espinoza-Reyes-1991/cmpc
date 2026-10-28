/** Pagination info returned with every paginated listing. */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

/** What a listing service returns; the interceptor turns it into `ApiResponse`. */
export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

/** Success envelope of the API (R5.1). */
export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
}
