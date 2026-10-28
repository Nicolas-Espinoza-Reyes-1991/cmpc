import { ApiError } from './api-error';

/** Statuses that mean "there is no such book": missing (404) or a malformed id (400). */
const MISSING_STATUSES: readonly number[] = [400, 404];

/**
 * True when reading a book failed because it does not exist. A 400 on a read
 * can only come from an `:id` that is not a UUID, and no book can have that id.
 */
export function isMissingBook(error: unknown): boolean {
  return error instanceof ApiError && MISSING_STATUSES.includes(error.status);
}
