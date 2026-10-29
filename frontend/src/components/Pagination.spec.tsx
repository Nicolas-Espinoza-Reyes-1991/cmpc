import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination } from './Pagination';

function renderPagination(
  props: Partial<Parameters<typeof Pagination>[0]> = {},
) {
  const onPage = vi.fn();
  const onLimit = vi.fn();
  render(
    <Pagination
      page={2}
      limit={10}
      total={45}
      onPage={onPage}
      onLimit={onLimit}
      {...props}
    />,
  );
  return { onPage, onLimit };
}

const previous = () => screen.getByRole('button', { name: 'Anterior' });
const next = () => screen.getByRole('button', { name: 'Siguiente' });

describe('Pagination', () => {
  it('tells where the user is', () => {
    renderPagination();

    expect(screen.getByText('Página 2 de 5')).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Paginación' }),
    ).toBeInTheDocument();
  });

  it.each([
    [0, 10, 1],
    [1, 10, 1],
    [10, 10, 1],
    [11, 10, 2],
    [100, 20, 5],
    [101, 20, 6],
  ])('shows %s results at %s per page as %s page(s)', (total, limit, pages) => {
    renderPagination({ page: 1, total, limit });

    expect(screen.getByText(`Página 1 de ${pages}`)).toBeInTheDocument();
  });

  it('goes to the previous and the next page', async () => {
    const { onPage } = renderPagination({ page: 3 });

    await userEvent.click(previous());
    await userEvent.click(next());

    expect(onPage).toHaveBeenNthCalledWith(1, 2);
    expect(onPage).toHaveBeenNthCalledWith(2, 4);
  });

  it('cannot go back from the first page', async () => {
    const { onPage } = renderPagination({ page: 1 });

    expect(previous()).toBeDisabled();
    expect(next()).toBeEnabled();
    await userEvent.click(previous());
    expect(onPage).not.toHaveBeenCalled();
  });

  it('cannot go forward from the last page', async () => {
    const { onPage } = renderPagination({ page: 5 });

    expect(next()).toBeDisabled();
    expect(previous()).toBeEnabled();
    await userEvent.click(next());
    expect(onPage).not.toHaveBeenCalled();
  });

  it('cannot move at all when everything fits in one page', () => {
    renderPagination({ page: 1, total: 3 });

    expect(previous()).toBeDisabled();
    expect(next()).toBeDisabled();
  });

  describe('page size', () => {
    it('offers 10, 20 and 50 and shows the current one', () => {
      renderPagination({ limit: 20 });

      const select = screen.getByRole('combobox', {
        name: 'Libros por página',
      });
      expect(select).toHaveValue('20');
      expect(
        [...select.querySelectorAll('option')].map((option) => option.value),
      ).toEqual(['10', '20', '50']);
    });

    it('reports the new size as a number', async () => {
      const { onLimit } = renderPagination();

      await userEvent.selectOptions(
        screen.getByRole('combobox', { name: 'Libros por página' }),
        '50',
      );

      expect(onLimit).toHaveBeenCalledWith(50);
    });
  });
});
