import { render, screen } from '@testing-library/react';
import { CoverDownload } from './CoverDownload';

describe('CoverDownload', () => {
  it('links to the stored cover, saved under a readable name', () => {
    render(<CoverDownload src="/api/uploads/3f6c2a52.png" title="Cien años" />);

    const link = screen.getByRole('link', { name: 'Descargar portada' });
    expect(link).toHaveAttribute('href', '/api/uploads/3f6c2a52.png');
    expect(link).toHaveAttribute('download', 'cien-anos.png');
  });
});
