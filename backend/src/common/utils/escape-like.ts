/**
 * Prisma passes `contains` to LIKE without escaping, so `%` and `_` would act as
 * wildcards ("a_b" would match "axb"). A backslash is LIKE's default escape, and
 * it must be escaped too or it would swallow the character that follows it.
 */
export const escapeLike = (text: string): string =>
  text.replace(/[\\%_]/g, '\\$&');
