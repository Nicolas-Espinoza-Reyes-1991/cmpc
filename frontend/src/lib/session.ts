const TOKEN_KEY = 'cmpc.token';

/**
 * Where the JWT lives. localStorage keeps the session across reloads; the
 * trade-off (readable by scripts on the page) is documented in the auth spec.
 */
export const session = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },

  clear(): void {
    localStorage.removeItem(TOKEN_KEY);
  },
};
