import { act, renderHook } from '@testing-library/react';
import { TYPING_PAUSE_MS, useUrlBoundText } from './useUrlBoundText';

function setup(initial = '') {
  const commit = vi.fn<(text: string) => void>();
  const view = renderHook(({ url }) => useUrlBoundText(url, commit), {
    initialProps: { url: initial },
  });
  const type = (text: string) =>
    act(() => {
      view.result.current[1](text);
    });
  const wait = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  return { commit, view, type, wait };
}

describe('useUrlBoundText', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with the value of the URL', () => {
    const { view } = setup('dune');

    expect(view.result.current[0]).toBe('dune');
  });

  it('shows what is typed at once but writes it only after a pause', () => {
    const { view, commit, type, wait } = setup();

    type('dune');
    expect(view.result.current[0]).toBe('dune');
    wait(TYPING_PAUSE_MS - 1);
    expect(commit).not.toHaveBeenCalled();

    wait(1);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith('dune');
  });

  it('writes once per pause, not once per key', () => {
    const { commit, type, wait } = setup();

    type('d');
    wait(200);
    type('du');
    wait(200);
    type('dun');
    wait(200);
    expect(commit).not.toHaveBeenCalled();

    type('dune');
    wait(TYPING_PAUSE_MS);

    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith('dune');
  });

  it('waits the delay it is given', () => {
    const commit = vi.fn();
    const { result } = renderHook(() => useUrlBoundText('', commit, 50));

    act(() => result.current[1]('a'));
    act(() => {
      vi.advanceTimersByTime(49);
    });
    expect(commit).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(commit).toHaveBeenCalledWith('a');
  });

  it('shows a new value the URL gets by itself (clear, back, a shared link)', () => {
    const { view } = setup('dune');

    view.rerender({ url: '' });

    expect(view.result.current[0]).toBe('');
  });

  it('cancels the pending write when the URL changes by itself', () => {
    const { view, commit, type, wait } = setup('dune');
    type('dune messiah');

    view.rerender({ url: '' });
    wait(TYPING_PAUSE_MS * 2);

    expect(commit).not.toHaveBeenCalled();
    expect(view.result.current[0]).toBe('');
  });

  it('does not lose letters typed while the URL catches up with its own write', () => {
    const { view, commit, type, wait } = setup();
    type('a');
    wait(TYPING_PAUSE_MS);
    expect(commit).toHaveBeenCalledWith('a');

    // The user keeps typing; only then does the URL show the first write.
    type('ab');
    view.rerender({ url: 'a' });

    expect(view.result.current[0]).toBe('ab');
    wait(TYPING_PAUSE_MS);
    expect(commit).toHaveBeenLastCalledWith('ab');
  });

  it('does not write after the screen is gone', () => {
    const { view, commit, type, wait } = setup();
    type('dune');

    view.unmount();
    wait(TYPING_PAUSE_MS * 2);

    expect(commit).not.toHaveBeenCalled();
  });
});
