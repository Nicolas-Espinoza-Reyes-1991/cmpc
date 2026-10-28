const DEFAULT_TARGET = '/books';

/**
 * An internal path: it starts with a single "/" and not with "//" or "/\"
 * (browsers read both as another host), and it has no scheme.
 */
const INTERNAL_PATH = /^\/(?![/\\])/;

/**
 * Where to send the user once signed in. The router keeps the page they were
 * trying to open in `location.state.from`; it is only used if it is an internal
 * path, so a crafted value can never turn the login into an open redirect
 * (A5.1). The login itself is never a target, or the user would loop.
 */
export function redirectTarget(state: unknown): string {
  if (typeof state !== 'object' || state === null) return DEFAULT_TARGET;

  const from: unknown = (state as { from?: unknown }).from;
  if (typeof from !== 'string' || !INTERNAL_PATH.test(from)) {
    return DEFAULT_TARGET;
  }

  return from === '/login' ? DEFAULT_TARGET : from;
}
