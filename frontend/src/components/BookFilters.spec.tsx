import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_PARAMS } from '../lib/book-list-params';
import { emptyCatalogs } from '../test/catalog-routes';
import { mockApi, type MockApi } from '../test/mock-api';
import { createQueryWrapper } from '../test/query-wrapper';
import { BookFilters } from './BookFilters';

type Props = Parameters<typeof BookFilters>[0];

function renderFilters(overrides: Partial<Props> = {}) {
  const props: Props = {
    params: DEFAULT_PARAMS,
    onChange: vi.fn(),
    onClear: vi.fn(),
    active: false,
    ...overrides,
  };
  const { wrapper } = createQueryWrapper();
  const view = render(<BookFilters {...props} />, { wrapper });
  return { props, ...view, wrapper };
}

/** Real timers: the typing pause is 300 ms, so give the assertion room. */
const PAUSE = { timeout: 1500 };

describe('BookFilters', () => {
  let api: MockApi;

  beforeEach(() => {
    api = mockApi(emptyCatalogs);
  });

  afterEach(() => {
    api.restore();
  });

  it('labels every control', () => {
    renderFilters();

    expect(screen.getByLabelText('Buscar por título')).toBeInTheDocument();
    expect(screen.getByLabelText('Autor')).toBeInTheDocument();
    expect(screen.getByLabelText('Editorial')).toBeInTheDocument();
    expect(screen.getByLabelText('Género')).toBeInTheDocument();
    expect(screen.getByLabelText('Disponibilidad')).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Búsqueda y filtros' }),
    ).toBeInTheDocument();
  });

  it('shows the values of the view', () => {
    renderFilters({
      params: {
        ...DEFAULT_PARAMS,
        search: 'dune',
        author: 'herbert',
        publisher: 'ace',
        genre: 'ficción',
        availability: false,
      },
    });

    expect(screen.getByLabelText('Buscar por título')).toHaveValue('dune');
    expect(screen.getByLabelText('Autor')).toHaveValue('herbert');
    expect(screen.getByLabelText('Editorial')).toHaveValue('ace');
    expect(screen.getByLabelText('Género')).toHaveValue('ficción');
    expect(screen.getByLabelText('Disponibilidad')).toHaveValue('false');
  });

  describe.each([
    ['Buscar por título', 'search'],
    ['Autor', 'author'],
    ['Editorial', 'publisher'],
    ['Género', 'genre'],
  ] as const)('the %s box', (label, key) => {
    it('writes what was typed once the user pauses, replacing the history entry', async () => {
      const { props } = renderFilters();

      await userEvent.type(screen.getByLabelText(label), 'abc');

      expect(props.onChange).not.toHaveBeenCalled();
      await waitFor(
        () =>
          expect(props.onChange).toHaveBeenCalledWith(
            { [key]: 'abc' },
            { replace: true },
          ),
        PAUSE,
      );
      expect(props.onChange).toHaveBeenCalledTimes(1);
    });

    it('shows a value the URL gets by itself', () => {
      const { props, rerender, wrapper } = renderFilters({
        params: { ...DEFAULT_PARAMS, [key]: 'viejo' },
      });
      expect(screen.getByLabelText(label)).toHaveValue('viejo');

      rerender(<BookFilters {...props} params={DEFAULT_PARAMS} />);

      expect(screen.getByLabelText(label)).toHaveValue('');
      expect(wrapper).toBeDefined();
    });
  });

  it('is a search box for the title', () => {
    renderFilters();

    expect(screen.getByLabelText('Buscar por título')).toHaveAttribute(
      'type',
      'search',
    );
  });

  describe('availability', () => {
    it('offers all, available and unavailable', () => {
      renderFilters();

      expect(
        [
          ...screen.getByLabelText('Disponibilidad').querySelectorAll('option'),
        ].map((option) => option.textContent),
      ).toEqual(['Todos', 'Disponibles', 'No disponibles']);
      expect(screen.getByLabelText('Disponibilidad')).toHaveValue('all');
    });

    it.each([
      ['true', true],
      ['false', false],
      ['all', undefined],
    ])('applies %s at once, without a pause', async (value, availability) => {
      const { props } = renderFilters({
        params: {
          ...DEFAULT_PARAMS,
          availability: value === 'all' ? true : undefined,
        },
      });

      await userEvent.selectOptions(
        screen.getByLabelText('Disponibilidad'),
        value,
      );

      expect(props.onChange).toHaveBeenCalledWith({ availability });
    });
  });

  describe('suggestions', () => {
    const options = (id: string) =>
      [...document.querySelectorAll(`#${CSS.escape(id)} option`)].map(
        (option) => option.getAttribute('value'),
      );

    it.each([
      ['Autor', '/authors', 'Gabriel García Márquez'],
      ['Editorial', '/publishers', 'Editorial Sudamericana'],
      ['Género', '/genres', 'Novela'],
    ])('offers the existing names for %s', async (label, route, name) => {
      api.restore();
      api = mockApi({
        ...emptyCatalogs,
        [`GET ${route}`]: { data: { data: [{ id: 'c1', name }] } },
      });
      renderFilters();

      const listId = screen.getByLabelText(label).getAttribute('list');
      await waitFor(() => expect(options(listId ?? '')).toEqual([name]));
    });

    it('does not offer suggestions for the title search', () => {
      renderFilters();

      expect(screen.getByLabelText('Buscar por título')).not.toHaveAttribute(
        'list',
      );
    });

    it('does not break the filter if the suggestions fail', async () => {
      api.restore();
      api = mockApi({ ...emptyCatalogs, 'GET /authors': { network: true } });
      const { props } = renderFilters();

      await userEvent.type(screen.getByLabelText('Autor'), 'herb');

      await waitFor(
        () =>
          expect(props.onChange).toHaveBeenCalledWith(
            { author: 'herb' },
            { replace: true },
          ),
        PAUSE,
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('clearing', () => {
    it('offers to clear the filters only when something narrows the listing', () => {
      const { rerender, props } = renderFilters({ active: false });
      expect(
        screen.queryByRole('button', { name: 'Limpiar filtros' }),
      ).not.toBeInTheDocument();

      rerender(<BookFilters {...props} active />);

      expect(
        screen.getByRole('button', { name: 'Limpiar filtros' }),
      ).toBeInTheDocument();
    });

    it('reports the clearing', async () => {
      const { props } = renderFilters({ active: true });

      await userEvent.click(
        screen.getByRole('button', { name: 'Limpiar filtros' }),
      );

      expect(props.onClear).toHaveBeenCalledTimes(1);
    });
  });
});
