const TOKEN_KEY = 'cmpc.token';

type Listener = () => void;

const listeners = new Set<Listener>();

function notify(): void {
  // A copy: a listener added during the notification waits for the next change
  // instead of joining this round, so a listener that subscribes another one can
  // never loop forever.
  for (const listener of [...listeners]) listener();
}

/**
 * The browser fires `storage` only in the OTHER tabs that share the storage, never
 * in the one that wrote it (that tab is notified directly by setToken/clear).
 * `key === null` means the whole storage was cleared.
 */
function onStorage(event: StorageEvent): void {
  if (event.storageArea !== localStorage) return;
  if (event.key === TOKEN_KEY || event.key === null) notify();
}

/**
 * Where the JWT lives. localStorage keeps the session across reloads; the
 * trade-off (readable by scripts on the page) is documented in the auth spec.
 *
 * It is observable, so the interface follows it without reloading: `getToken` and
 * `subscribe` are exactly what React's `useSyncExternalStore` expects. That makes
 * an expired session (the API client clears it on a 401, A5.4) or a logout in
 * another tab (A5.6) show up everywhere at once.
 *
 * The members are arrow functions, not methods, on purpose: none uses `this`, so
 * they can be handed over as they are (`useSyncExternalStore(session.subscribe,
 * session.getToken)`) without a wrapper and without losing anything.
 */
export const session = {
  getToken: (): string | null => localStorage.getItem(TOKEN_KEY),

  setToken: (token: string): void => {
    localStorage.setItem(TOKEN_KEY, token);
    notify();
  },

  clear: (): void => {
    localStorage.removeItem(TOKEN_KEY);
    notify();
  },

  /** Calls `listener` whenever the token changes. Returns the function that stops it. */
  subscribe: (listener: Listener): (() => void) => {
    // The window listener lives only while someone is subscribed.
    if (listeners.size === 0) window.addEventListener('storage', onStorage);
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        window.removeEventListener('storage', onStorage);
      }
    };
  },
};
