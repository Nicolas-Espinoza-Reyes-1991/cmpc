import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import type { Book, SortCriterion } from '../types/book';
import { BookTable } from './BookTable';

const book = (overrides: Partial<Book> = {}): Book => ({
  id: 'b1',
  title: 'Dune',
  author: 'Frank Herbert',
  publisher: 'Ace',
  genre: 'Ciencia ficción',
  price: 12990,
  availability: true,
  imageUrl: null,
  createdAt: '2026-10-28T10:00:00.000Z',
  updatedAt: '2026-10-28T10:00:00.000Z',
  ...overrides,
});

function renderTable(props: Partial<Parameters<typeof BookTable>[0]> = {}) {
  const onSort = vi.fn();
  render(
    <MemoryRouter>
      <BookTable
        books={[book()]}
        sort={[]}
        onSort={onSort}
        busy={false}
        {...props}
      />
    </MemoryRouter>,
  );
  return { onSort };
}

const header = (name: string) =>
  screen.getByRole('columnheader', { name: new RegExp(`^${name}`) });

describe('BookTable', () => {
  it('shows the columns of the listing', () => {
    renderTable();

    expect(
      screen
        .getAllByRole('columnheader')
        .map((th) => th.textContent?.replace(/[↑↓↕\d]/g, '')),
    ).toEqual([
      'Título',
      'Autor',
      'Editorial',
      'Género',
      'Precio',
      'Disponibilidad',
      'Registrado',
    ]);
  });

  it('shows one row per book with every field formatted', () => {
    renderTable({
      books: [
        book(),
        book({
          id: 'b2',
          title: 'Cien años de soledad',
          price: 9990.5,
          availability: false,
        }),
      ],
    });

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    const first = within(rows[0] as HTMLElement);
    expect(first.getByRole('link', { name: 'Dune' })).toHaveAttribute(
      'href',
      '/books/b1',
    );
    expect(first.getByText('Frank Herbert')).toBeInTheDocument();
    expect(first.getByText('Ace')).toBeInTheDocument();
    expect(first.getByText('Ciencia ficción')).toBeInTheDocument();
    expect(first.getByText('$12.990')).toBeInTheDocument();
    expect(first.getByText('Disponible')).toBeInTheDocument();
    expect(first.getByText(/^28-10-2026/)).toBeInTheDocument();
    const second = within(rows[1] as HTMLElement);
    expect(second.getByText('$9.990,50')).toBeInTheDocument();
    expect(second.getByText('No disponible')).toBeInTheDocument();
  });

  it('has an accessible caption', () => {
    renderTable();

    expect(screen.getByRole('table', { name: 'Libros' })).toBeInTheDocument();
  });

  describe('sorting', () => {
    it('marks every column as unsorted when there is no order', () => {
      renderTable();

      for (const th of screen.getAllByRole('columnheader')) {
        expect(th).toHaveAttribute('aria-sort', 'none');
      }
    });

    it('reports a press on a header with its field', async () => {
      const { onSort } = renderTable();

      await userEvent.click(screen.getByRole('button', { name: /^Precio/ }));
      await userEvent.click(
        screen.getByRole('button', { name: /^Registrado/ }),
      );

      expect(onSort).toHaveBeenNthCalledWith(1, 'price');
      expect(onSort).toHaveBeenNthCalledWith(2, 'createdAt');
    });

    it.each([
      ['asc', 'ascending', '↑'],
      ['desc', 'descending', '↓'],
    ] as const)(
      'shows a column sorted %s with aria-sort and an arrow, without a number',
      (direction, ariaSort, arrow) => {
        renderTable({ sort: [{ field: 'price', direction }] });

        expect(header('Precio')).toHaveAttribute('aria-sort', ariaSort);
        expect(header('Precio')).toHaveTextContent(arrow);
        expect(header('Precio').querySelector('sup')).toBeNull();
        expect(header('Autor')).toHaveAttribute('aria-sort', 'none');
      },
    );

    it('numbers the criteria by priority when there are several', () => {
      const sort: SortCriterion[] = [
        { field: 'genre', direction: 'asc' },
        { field: 'price', direction: 'desc' },
        { field: 'title', direction: 'asc' },
      ];
      renderTable({ sort });

      expect(header('Género').querySelector('sup')).toHaveTextContent('1');
      expect(header('Precio').querySelector('sup')).toHaveTextContent('2');
      expect(header('Título').querySelector('sup')).toHaveTextContent('3');
      expect(header('Autor').querySelector('sup')).toBeNull();
    });
  });

  it('marks the table as busy and dims it while a new page loads', () => {
    renderTable({ busy: true });

    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');
  });

  it('is not busy by default', () => {
    renderTable();

    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'false');
  });
});
