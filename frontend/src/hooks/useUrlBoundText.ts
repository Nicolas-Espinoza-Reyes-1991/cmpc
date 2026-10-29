import { useCallback, useEffect, useRef, useState } from 'react';

export const TYPING_PAUSE_MS = 300;

/**
 * A text box whose value lives in the URL. What the user types is written to the
 * URL only after they pause (`delayMs`), so the server is asked once per pause
 * and not once per key.
 *
 * It is a timer started by each key and not `useDebounce` of the text: after
 * "Limpiar filtros" a debounced copy would still hold the old text for a moment
 * and write it back. Here the pending write is cancelled instead.
 *
 * When the URL changes by itself (clear, back, a shared link) the box shows the
 * new value. A change the box made does not echo back into it, so letters typed
 * while the URL catches up are not lost.
 */
export function useUrlBoundText(
  urlValue: string,
  commit: (text: string) => void,
  delayMs: number = TYPING_PAUSE_MS,
) {
  const [text, setText] = useState(urlValue);
  // The last value this box wrote, or read from the URL. It tells an echo from an outside change.
  const known = useRef(urlValue);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (urlValue === known.current) return;
    known.current = urlValue;
    clearTimeout(timer.current);
    setText(urlValue);
  }, [urlValue]);

  // Do not write after the screen is gone.
  useEffect(() => () => clearTimeout(timer.current), []);

  const onChange = useCallback(
    (next: string) => {
      setText(next);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        known.current = next;
        commit(next);
      }, delayMs);
    },
    [commit, delayMs],
  );

  return [text, onChange] as const;
}
