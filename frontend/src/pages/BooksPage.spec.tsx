import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { BooksPage } from './BooksPage';

describe('BooksPage', () => {
  it('shows the heading and the way into the new book form', () => {
    render(
      <MemoryRouter>
        <BooksPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Libros' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nuevo libro' })).toHaveAttribute(
      'href',
      '/books/new',
    );
  });
});
