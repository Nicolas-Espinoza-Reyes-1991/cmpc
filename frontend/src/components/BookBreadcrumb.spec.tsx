import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { listingView } from '../lib/listingView';
import { BookBreadcrumb } from './BookBreadcrumb';

const renderBreadcrumb = () =>
  render(
    <MemoryRouter>
      <BookBreadcrumb title="Dune" />
    </MemoryRouter>,
  );

describe('BookBreadcrumb', () => {
  afterEach(() => {
    listingView.clear();
  });

  it('shows where the user is: the listing as a link and the book as the current page', () => {
    renderBreadcrumb();

    const nav = screen.getByRole('navigation', { name: 'Ruta de navegación' });
    expect(within(nav).getByRole('link', { name: 'Libros' })).toHaveAttribute(
      'href',
      '/books',
    );
    expect(within(nav).getByText('Dune')).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('has a back button that looks like one and says where it goes', () => {
    renderBreadcrumb();

    const back = screen.getByRole('link', { name: 'Volver a los libros' });
    expect(back).toHaveAttribute('href', '/books');
    expect(back).toHaveClass('border', 'rounded-md');
  });

  it('returns to the listing with the view the user left', () => {
    listingView.save('?q=dune&page=2');

    renderBreadcrumb();

    expect(screen.getByRole('link', { name: 'Libros' })).toHaveAttribute(
      'href',
      '/books?q=dune&page=2',
    );
    expect(
      screen.getByRole('link', { name: 'Volver a los libros' }),
    ).toHaveAttribute('href', '/books?q=dune&page=2');
  });
});
