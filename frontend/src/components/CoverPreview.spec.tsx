import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { CoverPreview } from './CoverPreview';

const src = '/uploads/dune.png';

function renderPreview(onError = vi.fn()) {
  render(<CoverPreview src={src} title="Dune" onError={onError} />);
  return { onError };
}

const thumbnail = () =>
  screen.getByRole('button', { name: 'Ampliar portada de Dune' });
const dialog = () => screen.queryByRole('dialog', { name: 'Dune' });

describe('CoverPreview sizes', () => {
  it('is the book page thumbnail by default: fixed width, 2:3, no size attributes', () => {
    renderPreview();

    const image = screen.getByRole('img', { name: 'Portada de Dune' });
    expect(thumbnail()).toHaveClass('w-40', 'sm:w-full');
    expect(image).toHaveClass('aspect-[2/3]');
    expect(image).not.toHaveAttribute('width');
    expect(image).not.toHaveAttribute('height');
  });

  it('is a 48 × 72 px thumbnail in a row, with its space reserved', () => {
    render(
      <CoverPreview src={src} title="Dune" onError={vi.fn()} size="row" />,
    );

    const image = screen.getByRole('img', { name: 'Portada de Dune' });
    expect(thumbnail()).toHaveClass('h-[72px]', 'w-12');
    expect(thumbnail()).not.toHaveClass('sm:w-full');
    expect(image).toHaveAttribute('width', '48');
    expect(image).toHaveAttribute('height', '72');
    expect(image).toHaveAttribute('loading', 'lazy');
  });

  it('opens the same dialog from a row thumbnail', async () => {
    render(
      <CoverPreview src={src} title="Dune" onError={vi.fn()} size="row" />,
    );

    await userEvent.click(thumbnail());

    expect(dialog()).toBeInTheDocument();
  });
});

describe('CoverPreview', () => {
  it('shows the cover as a thumbnail, lazy and decoded asynchronously', () => {
    renderPreview();

    const image = screen.getByRole('img', { name: 'Portada de Dune' });
    expect(image).toHaveAttribute('src', src);
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('decoding', 'async');
    expect(dialog()).not.toBeInTheDocument();
  });

  it('opens the cover at full size from the thumbnail', async () => {
    renderPreview();

    await userEvent.click(thumbnail());

    expect(dialog()).toBeInTheDocument();
    // The thumbnail stays on the page behind the dialog, so the enlarged image is looked up inside it.
    expect(
      within(dialog() as HTMLElement).getByRole('img', {
        name: 'Portada de Dune',
      }),
    ).toHaveAttribute('src', src);
  });

  it('closes with the Cerrar button and gives the focus back to the thumbnail', async () => {
    renderPreview();
    await userEvent.click(thumbnail());

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(dialog()).not.toBeInTheDocument();
    expect(thumbnail()).toHaveFocus();
  });

  it('closes with Escape', async () => {
    renderPreview();
    await userEvent.click(thumbnail());

    fireEvent(
      screen.getByRole('dialog', { name: 'Dune' }),
      new Event('cancel', { cancelable: true }),
    );

    expect(dialog()).not.toBeInTheDocument();
    expect(thumbnail()).toHaveFocus();
  });

  it('closes when the user clicks the backdrop, but not the image', async () => {
    renderPreview();
    await userEvent.click(thumbnail());

    await userEvent.click(
      within(dialog() as HTMLElement).getByRole('img', {
        name: 'Portada de Dune',
      }),
    );
    expect(dialog()).toBeInTheDocument();

    fireEvent.click(screen.getByRole('dialog', { name: 'Dune' }));
    expect(dialog()).not.toBeInTheDocument();
  });

  it('reports a thumbnail that fails to load', () => {
    const { onError } = renderPreview();

    fireEvent.error(screen.getByRole('img', { name: 'Portada de Dune' }));

    expect(onError).toHaveBeenCalledTimes(1);
  });
});
