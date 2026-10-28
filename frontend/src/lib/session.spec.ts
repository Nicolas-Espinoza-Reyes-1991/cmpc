import { session } from './session';

describe('session', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('has no token at the beginning', () => {
    expect(session.getToken()).toBeNull();
  });

  it('stores and returns the token', () => {
    session.setToken('jwt-token');

    expect(session.getToken()).toBe('jwt-token');
  });

  it('replaces the previous token', () => {
    session.setToken('first');
    session.setToken('second');

    expect(session.getToken()).toBe('second');
  });

  it('forgets the token when cleared', () => {
    session.setToken('jwt-token');

    session.clear();

    expect(session.getToken()).toBeNull();
  });
});
