import { fireEvent, render, screen, within } from '@testing-library/react';
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

/** The columns of data, which can be ordered (not the cover or the download). */
const sortableHeaders = () =>
  screen
    .getAllByRole('columnheader')
    .filter((th) => th.querySelector('button') !== null);

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
      'Portada',
      'Título',
      'Autor',
      'Editorial',
      'Género',
      'Precio',
      'Disponibilidad',
      'Registrado',
      'Descargar portada',
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

      for (const th of sortableHeaders()) {
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

  describe('covers', () => {
    const withCover = (id: string, title: string, name = id) =>
      book({ id, title, imageUrl: `/api/uploads/${name}.png` });
    const rowOf = (title: string) =>
      screen.getByRole('link', { name: title }).closest('tr') as HTMLElement;

    it('puts the cover first and the download last, and neither can be ordered', () => {
      renderTable({ books: [withCover('b1', 'Dune')] });

      const headers = screen.getAllByRole('columnheader');
      expect(headers[0]).toHaveTextContent('Portada');
      expect(headers[headers.length - 1]).toHaveTextContent(
        'Descargar portada',
      );
      expect(
        within(headers[0] as HTMLElement).queryByRole('button'),
      ).toBeNull();
      expect(
        within(headers.at(-1) as HTMLElement).queryByRole('button'),
      ).toBeNull();
      expect(headers[0]).not.toHaveAttribute('aria-sort');
      // The cell of the row is where the header says: the cover first, the download last.
      const cells = within(rowOf('Dune')).getAllByRole('cell');
      expect(
        within(cells[0] as HTMLElement).getByRole('button', {
          name: 'Ampliar portada de Dune',
        }),
      ).toBeInTheDocument();
      expect(
        within(cells.at(-1) as HTMLElement).getByRole('link', {
          name: 'Descargar portada de Dune',
        }),
      ).toBeInTheDocument();
    });

    it('keeps the hidden header text inside the scrolling box, so it cannot widen the page', () => {
      renderTable({ books: [withCover('b1', 'Dune')] });

      const box = screen.getByRole('table', { name: 'Libros' }).parentElement;
      expect(box).toHaveClass('relative', 'overflow-x-auto');
    });

    it('lets the text cells break a long word, so it cannot stretch the table into a scroll', () => {
      renderTable({
        books: [withCover('b1', 'titulotitulotitulotitulotitulo')],
      });

      const cells = within(
        rowOf('titulotitulotitulotitulotitulo'),
      ).getAllByRole('cell');
      // Title, author, publisher and genre; the cover, price, availability, date and download do not.
      const breaking = cells.filter((cell) =>
        cell.classList.contains('wrap-anywhere'),
      );
      expect(breaking).toHaveLength(4);
    });

    it('shows a thumbnail and a download for a book with a cover', () => {
      renderTable({ books: [withCover('b1', 'Cien años', 'abc')] });

      const row = within(rowOf('Cien años'));
      expect(
        row.getByRole('img', { name: 'Portada de Cien años' }),
      ).toHaveAttribute('src', '/api/uploads/abc.png');
      const download = row.getByRole('link', {
        name: 'Descargar portada de Cien años',
      });
      expect(download).toHaveAttribute('href', '/api/uploads/abc.png');
      expect(download).toHaveAttribute('download', 'cien-anos.png');
    });

    it('shows a marker and no download for a book without a cover', () => {
      renderTable({
        books: [book({ id: 'b1', title: 'Dune', imageUrl: null })],
      });

      const row = within(rowOf('Dune'));
      expect(
        row.getByRole('img', { name: 'Dune todavía no tiene portada' }),
      ).toBeInTheDocument();
      expect(row.queryByRole('link', { name: /Descargar/ })).toBeNull();
      expect(row.queryByRole('button', { name: /Ampliar/ })).toBeNull();
    });

    it('opens the cover of the row that was pressed, and only that one', async () => {
      renderTable({
        books: [withCover('b1', 'Dune'), withCover('b2', 'Neuromante')],
      });

      await userEvent.click(
        screen.getByRole('button', { name: 'Ampliar portada de Neuromante' }),
      );

      expect(
        screen.getByRole('dialog', { name: 'Neuromante' }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: 'Dune' })).toBeNull();
    });

    it('gives up the picture and the download of only the row whose file did not load', () => {
      renderTable({
        books: [withCover('b1', 'Dune'), withCover('b2', 'Neuromante')],
      });

      fireEvent.error(
        within(rowOf('Dune')).getByRole('img', { name: 'Portada de Dune' }),
      );

      const broken = within(rowOf('Dune'));
      expect(
        broken.getByRole('img', {
          name: 'La portada de Dune no se pudo cargar',
        }),
      ).toBeInTheDocument();
      expect(broken.queryByRole('link', { name: /Descargar/ })).toBeNull();
      const intact = within(rowOf('Neuromante'));
      expect(
        intact.getByRole('img', { name: 'Portada de Neuromante' }),
      ).toBeInTheDocument();
      expect(
        intact.getByRole('link', { name: 'Descargar portada de Neuromante' }),
      ).toBeInTheDocument();
    });

    it('keeps a broken cover broken while the same file is shown, and tries a new upload again', () => {
      const first = [withCover('b1', 'Dune', 'old')];
      const { rerender } = render(
        <MemoryRouter>
          <BookTable books={first} sort={[]} onSort={vi.fn()} busy={false} />
        </MemoryRouter>,
      );
      fireEvent.error(screen.getByRole('img', { name: 'Portada de Dune' }));
      expect(
        screen.getByRole('img', {
          name: 'La portada de Dune no se pudo cargar',
        }),
      ).toBeInTheDocument();

      rerender(
        <MemoryRouter>
          <BookTable books={first} sort={[]} onSort={vi.fn()} busy />
        </MemoryRouter>,
      );
      expect(
        screen.getByRole('img', {
          name: 'La portada de Dune no se pudo cargar',
        }),
      ).toBeInTheDocument();

      rerender(
        <MemoryRouter>
          <BookTable
            books={[withCover('b1', 'Dune', 'new')]}
            sort={[]}
            onSort={vi.fn()}
            busy={false}
          />
        </MemoryRouter>,
      );
      expect(
        screen.getByRole('img', { name: 'Portada de Dune' }),
      ).toHaveAttribute('src', '/api/uploads/new.png');
    });
  });
});
