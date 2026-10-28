// Contract types of the backend API. Keep them aligned with the DTOs and Swagger.

/** One failed form field with all of its messages (backend `FieldError`). */
export interface FieldError {
  field: string;
  messages: string[];
}

/** Body of every error response (backend `ErrorResponseBody`). */
export interface ErrorResponseBody {
  statusCode: number;
  message: string;
  errors?: FieldError[];
  path: string;
  timestamp: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

/** Success envelope of the API. */
export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
}
