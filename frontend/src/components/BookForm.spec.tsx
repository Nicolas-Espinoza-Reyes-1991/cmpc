import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { ApiError } from '../lib/api-error';
import { FormMessageError } from '../lib/form-message-error';
import type { BookFormValues } from '../lib/book-schema';
import { emptyCatalogs } from '../test/catalog-routes';
import { mockApi, type MockApi } from '../test/mock-api';
import { createQueryWrapper } from '../test/query-wrapper';
import type { ImageChoice } from '../types/book';
import { BookForm } from './BookForm';

const DEFAULTS = {
  title: '',
  author: '',
  publisher: '',
  genre: '',
  availability: true,
};

function renderForm(
  options: {
    onSubmit?: (values: BookFormValues, image: ImageChoice) => Promise<void>;
    defaultValues?: Parameters<typeof BookForm>[0]['defaultValues'];
  } = {},
) {
  const onSubmit = vi.fn<
    (values: BookFormValues, image: ImageChoice) => Promise<void>
  >(options.onSubmit ?? (() => Promise.resolve()));
  const { wrapper } = createQueryWrapper();
  render(
    <MemoryRouter>
      <BookForm
        defaultValues={options.defaultValues ?? DEFAULTS}
        submitLabel="Registrar libro"
        cancelTo="/books"
        onSubmit={onSubmit}
      />
    </MemoryRouter>,
    { wrapper },
  );
  return { onSubmit };
}

const field = (label: string) => screen.getByLabelText(label);
const submitButton = () =>
  screen.getByRole('button', { name: /Registrar libro|Guardando…/ });

async function fillValid(price = '9990.5') {
  await userEvent.type(field('Título'), 'Dune');
  await userEvent.type(field('Autor'), 'Frank Herbert');
  await userEvent.type(field('Editorial'), 'Ace');
  await userEvent.type(field('Género'), 'Ciencia ficción');
  if (price) await userEvent.type(field('Precio'), price);
}

describe('BookForm', () => {
  let api: MockApi;

  beforeEach(() => {
    api = mockApi(emptyCatalogs);
  });

  afterEach(() => {
    api.restore();
  });

  it('shows every field with its label, the title focused and the book available', () => {
    renderForm();

    for (const label of ['Título', 'Autor', 'Editorial', 'Género', 'Precio']) {
      expect(field(label)).toBeInTheDocument();
    }
    expect(screen.getByRole('checkbox', { name: 'Disponible' })).toBeChecked();
    expect(field('Título')).toHaveFocus();
    expect(field('Precio')).toHaveValue(null);
  });

  it('links Cancelar to the given route', () => {
    renderForm();

    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute(
      'href',
      '/books',
    );
  });

  describe('validation', () => {
    it('asks for every required field in Spanish and sends nothing', async () => {
      const { onSubmit } = renderForm();

      await userEvent.click(submitButton());

      expect(await screen.findByText('Ingresa el título.')).toBeInTheDocument();
      expect(screen.getByText('Ingresa el autor.')).toBeInTheDocument();
      expect(screen.getByText('Ingresa la editorial.')).toBeInTheDocument();
      expect(screen.getByText('Ingresa el género.')).toBeInTheDocument();
      expect(screen.getByText('Ingresa un precio válido.')).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('marks the invalid fields and ties each one to its message', async () => {
      renderForm();

      await userEvent.click(submitButton());

      const title = field('Título');
      await waitFor(() =>
        expect(title).toHaveAttribute('aria-invalid', 'true'),
      );
      expect(title).toHaveAccessibleDescription('Ingresa el título.');
      expect(field('Precio')).toHaveAccessibleDescription(
        'Ingresa un precio válido.',
      );
    });

    it('puts the focus on the first field with a problem', async () => {
      renderForm();
      await userEvent.type(field('Título'), 'Dune');
      await userEvent.type(field('Autor'), 'Frank Herbert');
      await userEvent.type(field('Editorial'), 'Ace');
      await userEvent.type(field('Género'), 'Novela');

      await userEvent.click(submitButton());

      await waitFor(() => expect(field('Precio')).toHaveFocus());
    });

    it('validates a field when it loses focus, then on every change', async () => {
      renderForm();
      await userEvent.click(field('Título'));
      await userEvent.tab();

      expect(await screen.findByText('Ingresa el título.')).toBeInTheDocument();

      await userEvent.type(field('Título'), 'D');
      await waitFor(() =>
        expect(
          screen.queryByText('Ingresa el título.'),
        ).not.toBeInTheDocument(),
      );
    });

    it.each([
      ['0', 'El precio debe ser mayor que 0.'],
      ['-5', 'El precio debe ser mayor que 0.'],
      ['0.001', 'El precio mínimo es 0,01.'],
      ['10.123', 'El precio admite como máximo dos decimales.'],
      ['100000000', 'El precio no puede superar 99.999.999,99.'],
    ])('rejects the price %s with one message', async (price, message) => {
      const { onSubmit } = renderForm();
      await fillValid(price);

      await userEvent.click(submitButton());

      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('rejects a title longer than 200 characters', async () => {
      const { onSubmit } = renderForm({
        defaultValues: { ...DEFAULTS, title: 'a'.repeat(201) },
      });
      await userEvent.type(field('Autor'), 'A');
      await userEvent.type(field('Editorial'), 'E');
      await userEvent.type(field('Género'), 'G');
      await userEvent.type(field('Precio'), '10');

      await userEvent.click(submitButton());

      expect(
        await screen.findByText(
          'El título no puede superar los 200 caracteres.',
        ),
      ).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('submitting', () => {
    it('sends the values as they will be saved: trimmed, with a numeric price', async () => {
      const { onSubmit } = renderForm();
      await userEvent.type(field('Título'), '  Dune   Messiah ');
      await userEvent.type(field('Autor'), 'Frank Herbert');
      await userEvent.type(field('Editorial'), 'Ace');
      await userEvent.type(field('Género'), 'Ciencia ficción');
      await userEvent.type(field('Precio'), '9990.5');

      await userEvent.click(submitButton());

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0]?.[0]).toEqual({
        title: 'Dune Messiah',
        author: 'Frank Herbert',
        publisher: 'Ace',
        genre: 'Ciencia ficción',
        price: 9990.5,
        availability: true,
      });
    });

    it('sends availability false when the box is cleared', async () => {
      const { onSubmit } = renderForm();
      await fillValid();
      await userEvent.click(
        screen.getByRole('checkbox', { name: 'Disponible' }),
      );

      await userEvent.click(submitButton());

      await waitFor(() => expect(onSubmit).toHaveBeenCalled());
      expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
        availability: false,
      });
    });

    it('starts from the values it is given (editing)', () => {
      renderForm({
        defaultValues: {
          title: 'Dune',
          author: 'Frank Herbert',
          publisher: 'Ace',
          genre: 'Novela',
          price: 9990.5,
          availability: false,
        },
      });

      expect(field('Título')).toHaveValue('Dune');
      expect(field('Precio')).toHaveValue(9990.5);
      expect(
        screen.getByRole('checkbox', { name: 'Disponible' }),
      ).not.toBeChecked();
    });

    it('disables the button and says "Guardando…" while it saves, and ignores a second click', async () => {
      let finish: () => void = () => undefined;
      const { onSubmit } = renderForm({
        onSubmit: () => new Promise<void>((resolve) => (finish = resolve)),
      });
      await fillValid();

      await userEvent.click(submitButton());
      const busy = await screen.findByRole('button', { name: 'Guardando…' });
      expect(busy).toBeDisabled();
      await userEvent.click(busy);

      expect(onSubmit).toHaveBeenCalledTimes(1);

      finish();
      expect(
        await screen.findByRole('button', { name: 'Registrar libro' }),
      ).toBeEnabled();
    });
  });

  describe('when saving fails', () => {
    it('shows each message of a 400 under its own field, not in the alert', async () => {
      renderForm({
        onSubmit: () =>
          Promise.reject(
            new ApiError(400, 'Revisa los datos.', [
              { field: 'title', messages: ['title should not be empty'] },
              { field: 'price', messages: ['must be a number', 'too small'] },
            ]),
          ),
      });
      await fillValid();

      await userEvent.click(submitButton());

      await waitFor(() =>
        expect(field('Título')).toHaveAccessibleDescription(
          'title should not be empty',
        ),
      );
      expect(field('Precio')).toHaveAccessibleDescription(
        'must be a number too small',
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows a 400 about availability next to its checkbox', async () => {
      renderForm({
        onSubmit: () =>
          Promise.reject(
            new ApiError(400, 'Revisa los datos.', [
              { field: 'availability', messages: ['must be a boolean'] },
            ]),
          ),
      });
      await fillValid();

      await userEvent.click(submitButton());

      expect(await screen.findByText('must be a boolean')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows the message of a 400 whose fields this form does not have', async () => {
      renderForm({
        onSubmit: () =>
          Promise.reject(
            new ApiError(400, 'Revisa los datos.', [
              { field: 'imageUrl', messages: ['should not exist'] },
            ]),
          ),
      });
      await fillValid();

      await userEvent.click(submitButton());

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Revisa los datos.',
      );
    });

    it('explains a 409 as a duplicate book and keeps what was typed', async () => {
      renderForm({
        onSubmit: () => Promise.reject(new ApiError(409, 'Conflicto.')),
      });
      await fillValid();

      await userEvent.click(submitButton());

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Ya existe un libro con el mismo título, autor y editorial.',
      );
      expect(field('Título')).toHaveValue('Dune');
      expect(field('Precio')).toHaveValue(9990.5);
    });

    it.each([
      [
        'a network failure',
        new ApiError(0, 'No hay conexión con el servidor.'),
      ],
      ['a server error', new ApiError(500, 'Error del servidor.')],
    ])('shows the message of %s', async (_label, error) => {
      renderForm({ onSubmit: () => Promise.reject(error) });
      await fillValid();

      await userEvent.click(submitButton());

      expect(await screen.findByRole('alert')).toHaveTextContent(error.message);
    });

    it('shows a generic message for an unexpected error', async () => {
      renderForm({ onSubmit: () => Promise.reject(new Error('boom')) });
      await fillValid();

      await userEvent.click(submitButton());

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Ocurrió un error inesperado.',
      );
    });

    it('clears the alert when the user tries again', async () => {
      const onSubmit = vi
        .fn<(values: BookFormValues, image: ImageChoice) => Promise<void>>()
        .mockRejectedValueOnce(new ApiError(500, 'Error del servidor.'))
        .mockResolvedValue(undefined);
      const { wrapper } = createQueryWrapper();
      render(
        <MemoryRouter>
          <BookForm
            defaultValues={DEFAULTS}
            submitLabel="Registrar libro"
            cancelTo="/books"
            onSubmit={onSubmit}
          />
        </MemoryRouter>,
        { wrapper },
      );
      await fillValid();
      await userEvent.click(submitButton());
      await screen.findByRole('alert');

      await userEvent.click(submitButton());

      await waitFor(() =>
        expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
      );
      expect(onSubmit).toHaveBeenCalledTimes(2);
    });
  });

  describe('the cover', () => {
    const file = () =>
      new File([new Uint8Array([1, 2, 3])], 'portada.png', {
        type: 'image/png',
      });
    const coverInput = () => screen.getByLabelText('Portada (opcional)');
    // The file dialog filters by `accept`; the test drops the file directly.
    const upload = (chosen: File) =>
      userEvent.setup({ applyAccept: false }).upload(coverInput(), chosen);

    it('sends no cover when none is chosen', async () => {
      const { onSubmit } = renderForm();
      await fillValid();

      await userEvent.click(submitButton());

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0]?.[1]).toEqual({
        image: null,
        removeImage: false,
      });
    });

    it('sends the chosen file together with the values', async () => {
      const { onSubmit } = renderForm();
      await fillValid();
      const chosen = file();
      await upload(chosen);

      await userEvent.click(submitButton());

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0]?.[1]).toEqual({
        image: chosen,
        removeImage: false,
      });
      expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ title: 'Dune' });
    });

    it('does not block the form because of a rejected file', async () => {
      const { onSubmit } = renderForm();
      await fillValid();
      await upload(new File(['x'], 'a.gif', { type: 'image/gif' }));
      expect(
        screen.getByText('La portada debe ser una imagen JPG, PNG o WebP.'),
      ).toBeInTheDocument();

      await userEvent.click(submitButton());

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0]?.[1]).toEqual({
        image: null,
        removeImage: false,
      });
    });

    it('shows the current cover when editing and sends the removal', async () => {
      const onSubmit = vi.fn<
        (values: BookFormValues, image: ImageChoice) => Promise<void>
      >(() => Promise.resolve());
      const { wrapper } = createQueryWrapper();
      render(
        <MemoryRouter>
          <BookForm
            defaultValues={{
              title: 'Dune',
              author: 'Frank Herbert',
              publisher: 'Ace',
              genre: 'Novela',
              price: 100,
              availability: true,
            }}
            submitLabel="Guardar cambios"
            cancelTo="/books/b1"
            currentImageUrl="/api/uploads/x.png"
            onSubmit={onSubmit}
          />
        </MemoryRouter>,
        { wrapper },
      );
      expect(
        screen.getByRole('img', { name: 'Portada actual del libro' }),
      ).toHaveAttribute('src', '/api/uploads/x.png');
      await userEvent.click(screen.getByLabelText('Quitar la imagen actual'));

      await userEvent.click(
        screen.getByRole('button', { name: 'Guardar cambios' }),
      );

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect((onSubmit.mock.calls[0] as unknown as unknown[])[1]).toEqual({
        image: null,
        removeImage: true,
      });
    });

    it('shows a message written for the user exactly as it is', async () => {
      renderForm({
        onSubmit: () =>
          Promise.reject(
            new FormMessageError('Los datos se guardaron, pero la portada no.'),
          ),
      });
      await fillValid();

      await userEvent.click(submitButton());

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Los datos se guardaron, pero la portada no.',
      );
    });
  });

  describe('suggestions for author, publisher and genre', () => {
    const options = (listId: string) =>
      [...document.querySelectorAll(`#${listId} option`)].map(
        (option) => option.getAttribute('value') ?? '',
      );

    it('offers the existing names that match what is typed', async () => {
      api.restore();
      api = mockApi({
        ...emptyCatalogs,
        'GET /authors': (config) => {
          const { search } = config.params as { search?: string };
          return {
            data: {
              data: search
                ? [{ id: 'a1', name: 'Gabriel García Márquez' }]
                : [{ id: 'a0', name: 'Cualquiera' }],
            },
          };
        },
      });
      renderForm();
      await waitFor(() =>
        expect(options('author-options')).toEqual(['Cualquiera']),
      );

      await userEvent.type(field('Autor'), 'gabr');

      await waitFor(() =>
        expect(options('author-options')).toEqual(['Gabriel García Márquez']),
      );
    });

    it('waits for the user to pause before asking for new suggestions', async () => {
      renderForm();
      await waitFor(() => expect(api.requests).toHaveLength(3));

      await userEvent.type(field('Género'), 'novela', { delay: 10 });
      await waitFor(() => expect(api.requests).toHaveLength(4));

      // Six keystrokes made one request, not six.
      expect(
        api.requests.filter((request) => request.url === '/genres'),
      ).toHaveLength(2);
    });

    it('still lets the user type any name when the suggestions fail', async () => {
      api.restore();
      api = mockApi({ ...emptyCatalogs, 'GET /publishers': { network: true } });
      const { onSubmit } = renderForm();

      await fillValid();
      await userEvent.click(submitButton());

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
