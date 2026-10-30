import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useDocumentTitle } from './useDocumentTitle';

describe('useDocumentTitle', () => {
  beforeEach(() => {
    document.title = 'CMPC Libros';
  });

  afterEach(() => {
    document.title = 'CMPC Libros';
  });

  it('puts the screen before the name of the app', () => {
    renderHook(() => useDocumentTitle('Nuevo libro'));

    expect(document.title).toBe('Nuevo libro · CMPC Libros');
  });

  it('follows the title while mounted', () => {
    const { rerender } = renderHook(({ title }) => useDocumentTitle(title), {
      initialProps: { title: 'Libro' },
    });
    expect(document.title).toBe('Libro · CMPC Libros');

    rerender({ title: 'Dune' });

    expect(document.title).toBe('Dune · CMPC Libros');
  });

  it('gives back the previous title when the screen goes away', () => {
    const { unmount } = renderHook(() => useDocumentTitle('Dune'));

    unmount();

    expect(document.title).toBe('CMPC Libros');
  });
});
