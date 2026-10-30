import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { BookActionsCell } from './BookActionsCell';

const src = '/api/uploads/3f6c2a52.png';

const renderCell = (imageUrl: string | null) =>
  render(
    <MemoryRouter>
      <BookActionsCell id="b1" title="Cien años" imageUrl={imageUrl} />
    </MemoryRouter>,
  );

describe('BookActionsCell', () => {
  it('opens the book with a "Ver" link that names the book', () => {
    renderCell(null);

    const link = screen.getByRole('link', { name: 'Ver detalle de Cien años' });
    expect(link).toHaveTextContent('Ver');
    expect(link).toHaveAttribute('href', '/books/b1');
  });

  it('also offers the download of the cover under a readable name, naming the book', () => {
    renderCell(src);

    const link = screen.getByRole('link', {
      name: 'Descargar portada de Cien años',
    });
    expect(link).toHaveAttribute('href', src);
    expect(link).toHaveAttribute('download', 'cien-anos.png');
  });

  it('has no download when there is no cover, but keeps "Ver"', () => {
    renderCell(null);

    expect(screen.queryByRole('link', { name: /Descargar/ })).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
});
