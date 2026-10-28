/**
 * Trims a text and collapses repeated spaces into one (C2.3). Anything that is
 * not text is returned as it is, so `@IsString` still rejects it with a clear message.
 * Meant for `@Transform(trimText)` before the validators run.
 */
export const trimText = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;
