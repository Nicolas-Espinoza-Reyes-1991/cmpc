import { act, render, screen } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { session } from './session';

/** What another tab's write looks like from this tab: only a `storage` event arrives. */
function storageEventFromAnotherTab(key: string | null, area = localStorage) {
  window.dispatchEvent(new StorageEvent('storage', { key, storageArea: area }));
}

describe('session', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('storing the token', () => {
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

  describe('subscribe', () => {
    it('notifies when the token is set', () => {
      const listener = vi.fn();
      const unsubscribe = session.subscribe(listener);

      session.setToken('jwt-token');

      expect(listener).toHaveBeenCalledTimes(1);
      unsubscribe();
    });

    it('notifies when the session is cleared', () => {
      session.setToken('jwt-token');
      const listener = vi.fn();
      const unsubscribe = session.subscribe(listener);

      session.clear();

      expect(listener).toHaveBeenCalledTimes(1);
      unsubscribe();
    });

    it('shows the new value already when the listener runs', () => {
      let seen: string | null | undefined;
      const unsubscribe = session.subscribe(() => {
        seen = session.getToken();
      });

      session.setToken('fresh-token');

      expect(seen).toBe('fresh-token');
      unsubscribe();
    });

    it('stops notifying once unsubscribed', () => {
      const listener = vi.fn();
      const unsubscribe = session.subscribe(listener);
      unsubscribe();

      session.setToken('jwt-token');
      session.clear();

      expect(listener).not.toHaveBeenCalled();
    });

    it('notifies every subscriber', () => {
      const first = vi.fn();
      const second = vi.fn();
      const stopFirst = session.subscribe(first);
      const stopSecond = session.subscribe(second);

      session.setToken('jwt-token');

      expect(first).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(1);
      stopFirst();
      stopSecond();
    });

    it('lets a listener unsubscribe itself while being notified without skipping the others', () => {
      const before = vi.fn();
      const after = vi.fn();
      const stopBefore = session.subscribe(before);
      const stopSelf = session.subscribe(() => stopSelf());
      const stopAfter = session.subscribe(after);

      session.setToken('jwt-token');
      session.setToken('another-token');

      // Both neighbours hear every change; the one that left is gone for good.
      expect(before).toHaveBeenCalledTimes(2);
      expect(after).toHaveBeenCalledTimes(2);
      stopBefore();
      stopAfter();
    });

    it('does not call a listener subscribed during a notification until the next change', () => {
      const late = vi.fn();
      let stopLate: (() => void) | undefined;
      const stopFirst = session.subscribe(() => {
        stopLate ??= session.subscribe(late);
      });

      session.setToken('first-change');
      expect(late).not.toHaveBeenCalled();

      session.setToken('second-change');
      expect(late).toHaveBeenCalledTimes(1);
      stopFirst();
      stopLate?.();
    });

    it('tolerates being unsubscribed twice', () => {
      const other = vi.fn();
      const stopOther = session.subscribe(other);
      const stop = session.subscribe(vi.fn());

      stop();
      stop();
      session.setToken('jwt-token');

      expect(other).toHaveBeenCalledTimes(1);
      stopOther();
    });
  });

  describe('other tabs (A5.6)', () => {
    it('notifies when another tab changes the token', () => {
      const listener = vi.fn();
      const unsubscribe = session.subscribe(listener);

      localStorage.setItem('cmpc.token', 'token-from-another-tab');
      storageEventFromAnotherTab('cmpc.token');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(session.getToken()).toBe('token-from-another-tab');
      unsubscribe();
    });

    it('notifies when another tab logs out (the token is removed)', () => {
      session.setToken('jwt-token');
      const listener = vi.fn();
      const unsubscribe = session.subscribe(listener);

      localStorage.removeItem('cmpc.token');
      storageEventFromAnotherTab('cmpc.token');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(session.getToken()).toBeNull();
      unsubscribe();
    });

    it('notifies when another tab clears the whole storage (key is null)', () => {
      const listener = vi.fn();
      const unsubscribe = session.subscribe(listener);

      storageEventFromAnotherTab(null);

      expect(listener).toHaveBeenCalledTimes(1);
      unsubscribe();
    });

    it('ignores changes to other keys', () => {
      const listener = vi.fn();
      const unsubscribe = session.subscribe(listener);

      storageEventFromAnotherTab('some.other.key');

      expect(listener).not.toHaveBeenCalled();
      unsubscribe();
    });

    it('ignores events from sessionStorage', () => {
      const listener = vi.fn();
      const unsubscribe = session.subscribe(listener);

      storageEventFromAnotherTab('cmpc.token', sessionStorage);

      expect(listener).not.toHaveBeenCalled();
      unsubscribe();
    });

    it('stops listening to the window when the last subscriber leaves', () => {
      const add = vi.spyOn(window, 'addEventListener');
      const remove = vi.spyOn(window, 'removeEventListener');
      const stopFirst = session.subscribe(vi.fn());
      const stopSecond = session.subscribe(vi.fn());

      const adds = add.mock.calls.filter(([type]) => type === 'storage');
      stopFirst();
      const removesAfterFirst = remove.mock.calls.filter(
        ([type]) => type === 'storage',
      );
      stopSecond();
      const removesAfterSecond = remove.mock.calls.filter(
        ([type]) => type === 'storage',
      );

      // One window listener however many subscribers; removed only with the last one.
      expect(adds).toHaveLength(1);
      expect(removesAfterFirst).toHaveLength(0);
      expect(removesAfterSecond).toHaveLength(1);
      vi.restoreAllMocks();
    });
  });

  describe('with React (useSyncExternalStore)', () => {
    function TokenProbe() {
      const token = useSyncExternalStore(session.subscribe, session.getToken);
      return <p>token: {token ?? 'none'}</p>;
    }

    it('re-renders when this tab sets or clears the token', () => {
      render(<TokenProbe />);
      expect(screen.getByText('token: none')).toBeInTheDocument();

      act(() => session.setToken('abc'));
      expect(screen.getByText('token: abc')).toBeInTheDocument();

      act(() => session.clear());
      expect(screen.getByText('token: none')).toBeInTheDocument();
    });

    it('re-renders when another tab logs out, without a reload', () => {
      session.setToken('abc');
      render(<TokenProbe />);
      expect(screen.getByText('token: abc')).toBeInTheDocument();

      act(() => {
        localStorage.removeItem('cmpc.token');
        storageEventFromAnotherTab('cmpc.token');
      });

      expect(screen.getByText('token: none')).toBeInTheDocument();
    });

    it('stops reacting once the component is gone', () => {
      const { unmount } = render(<TokenProbe />);
      unmount();
      const remove = vi.spyOn(window, 'removeEventListener');

      session.setToken('abc');

      // No error, and nothing left subscribed to the window.
      expect(remove).not.toHaveBeenCalledWith('storage', expect.anything());
      vi.restoreAllMocks();
    });
  });
});
