import { render, screen } from '@testing-library/react';
import { CoverDownload } from './CoverDownload';

describe('CoverDownload', () => {
  it('links to the stored cover, saved under a readable name', () => {
    render(<CoverDownload src="/api/uploads/3f6c2a52.png" title="Cien años" />);

    const link = screen.getByRole('link', { name: 'Descargar portada' });
    expect(link).toHaveAttribute('href', '/api/uploads/3f6c2a52.png');
    expect(link).toHaveAttribute('download', 'cien-anos.png');
  });

  it('keeps the name of the book page when no size is given', () => {
    render(<CoverDownload src="/api/uploads/3f6c2a52.png" title="Cien años" />);

    const link = screen.getByRole('link', { name: 'Descargar portada' });
    expect(link).not.toHaveAttribute('aria-label');
    expect(link).toHaveTextContent('Descargar portada');
  });

  it('in a row says "Descargar", names the book for screen readers and is easy to touch', () => {
    render(
      <CoverDownload
        src="/api/uploads/3f6c2a52.webp"
        title="Cien años"
        size="row"
      />,
    );

    const link = screen.getByRole('link', {
      name: 'Descargar portada de Cien años',
    });
    expect(link).toHaveTextContent(/^Descargar$/);
    expect(link).toHaveAttribute('href', '/api/uploads/3f6c2a52.webp');
    expect(link).toHaveAttribute('download', 'cien-anos.webp');
    expect(link).toHaveClass('min-h-11', 'sm:min-h-0');
  });
});
