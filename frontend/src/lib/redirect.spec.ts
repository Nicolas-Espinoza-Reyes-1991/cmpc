import { redirectTarget } from './redirect';

describe('redirectTarget', () => {
  it('goes back to the internal page the user was trying to open', () => {
    expect(redirectTarget({ from: '/books' })).toBe('/books');
    expect(redirectTarget({ from: '/books/42' })).toBe('/books/42');
  });

  it('keeps the query string and the hash of an internal path', () => {
    expect(redirectTarget({ from: '/books?page=2#top' })).toBe(
      '/books?page=2#top',
    );
  });

  describe('falls back to /books when there is nothing usable', () => {
    it.each([
      ['no state', null],
      ['undefined state', undefined],
      ['a state that is not an object', 'books'],
      ['a state without from', {}],
      ['a from that is not text', { from: 42 }],
      ['a null from', { from: null }],
      ['an object as from', { from: { path: '/books' } }],
      ['an empty from', { from: '' }],
    ])('with %s', (_label, state) => {
      expect(redirectTarget(state)).toBe('/books');
    });
  });

  describe('never leaves the application (no open redirect)', () => {
    it.each([
      ['a protocol-relative URL', '//evil.test/steal'],
      ['an absolute URL', 'https://evil.test'],
      ['a javascript: URL', 'javascript:alert(1)'],
      ['a backslash variant', '/\\evil.test'],
      ['a path without leading slash', 'books'],
      ['a data: URL', 'data:text/html,<script>1</script>'],
    ])('rejects %s', (_label, from) => {
      expect(redirectTarget({ from })).toBe('/books');
    });
  });

  it('never sends the user back to the login itself', () => {
    expect(redirectTarget({ from: '/login' })).toBe('/books');
  });
});
