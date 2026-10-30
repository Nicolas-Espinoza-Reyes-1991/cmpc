import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { BookCoverCell } from './BookCoverCell';
import { BookDownloadCell } from './BookDownloadCell';

const src = '/api/uploads/3f6c2a52.png';

describe('BookCoverCell', () => {
  it('shows the cover as a small thumbnail of the book, lazy and with its space reserved', () => {
    render(
      <BookCoverCell
        title="Dune"
        imageUrl={src}
        broken={false}
        onError={vi.fn()}
      />,
    );

    const image = screen.getByRole('img', { name: 'Portada de Dune' });
    expect(image).toHaveAttribute('src', src);
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('width', '48');
    expect(image).toHaveAttribute('height', '72');
    expect(
      screen.getByRole('button', { name: 'Ampliar portada de Dune' }),
    ).toBeInTheDocument();
  });

  it('opens the cover at full size and gives the focus back to the thumbnail', async () => {
    render(
      <BookCoverCell
        title="Dune"
        imageUrl={src}
        broken={false}
        onError={vi.fn()}
      />,
    );
    const thumbnail = screen.getByRole('button', {
      name: 'Ampliar portada de Dune',
    });

    await userEvent.click(thumbnail);
    const dialog = screen.getByRole('dialog', { name: 'Dune' });
    expect(
      within(dialog).getByRole('img', { name: 'Portada de Dune' }),
    ).toHaveAttribute('src', src);

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Cerrar' }),
    );
    expect(thumbnail).toHaveFocus();
  });

  it('tells the page when the file does not load', () => {
    const onError = vi.fn();
    render(
      <BookCoverCell
        title="Dune"
        imageUrl={src}
        broken={false}
        onError={onError}
      />,
    );

    fireEvent.error(screen.getByRole('img', { name: 'Portada de Dune' }));

    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('shows a marker of the same size when the book has no cover', () => {
    render(
      <BookCoverCell
        title="Dune"
        imageUrl={null}
        broken={false}
        onError={vi.fn()}
      />,
    );

    const marker = screen.getByRole('img', {
      name: 'Dune todavía no tiene portada',
    });
    expect(marker).toHaveTextContent('Sin portada');
    expect(marker).toHaveClass('h-[72px]', 'w-12');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('says that the cover could not be loaded when it is broken', () => {
    render(
      <BookCoverCell title="Dune" imageUrl={null} broken onError={vi.fn()} />,
    );

    expect(
      screen.getByRole('img', { name: 'La portada de Dune no se pudo cargar' }),
    ).toHaveTextContent('Sin portada');
  });
});

describe('BookDownloadCell', () => {
  it('offers the download of the cover under a readable name, naming the book', () => {
    render(<BookDownloadCell title="Cien años" imageUrl={src} />);

    const link = screen.getByRole('link', {
      name: 'Descargar portada de Cien años',
    });
    expect(link).toHaveAttribute('href', src);
    expect(link).toHaveAttribute('download', 'cien-anos.png');
  });

  it('is empty when there is no cover to download', () => {
    const { container } = render(
      <BookDownloadCell title="Dune" imageUrl={null} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
