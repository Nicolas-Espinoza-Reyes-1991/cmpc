import { useMutation, useQuery } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useErrorNotice } from '../hooks/useErrorNotice';
import { ApiError } from '../lib/api-error';
import { AppProviders } from './AppProviders';

function FailingQuery({ silent }: { silent: boolean }) {
  const { status } = useQuery({
    queryKey: ['failing', silent],
    queryFn: () =>
      Promise.reject(
        new ApiError(404, 'No se encontró el recurso solicitado.'),
      ),
    meta: { silent },
  });
  return <p>query: {status}</p>;
}

function FailingMutation({ silent }: { silent: boolean }) {
  const { mutate, status } = useMutation({
    mutationFn: () =>
      Promise.reject(
        new ApiError(409, 'Ya existe un registro con esos datos.'),
      ),
    meta: { silent },
  });
  return (
    <>
      <button type="button" onClick={() => mutate()}>
        Guardar
      </button>
      <p>mutation: {status}</p>
    </>
  );
}

function Notifier({ error }: { error: unknown }) {
  const { notify } = useErrorNotice();
  return (
    <button type="button" onClick={() => notify(error)}>
      Fallar
    </button>
  );
}

describe('AppProviders', () => {
  describe('failed queries and mutations', () => {
    it('shows the message of a failed query', async () => {
      render(
        <AppProviders>
          <FailingQuery silent={false} />
        </AppProviders>,
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'No se encontró el recurso solicitado.',
      );
    });

    it('does not repeat the error of a silent query', async () => {
      render(
        <AppProviders>
          <FailingQuery silent />
        </AppProviders>,
      );

      expect(await screen.findByText('query: error')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows the message of a failed mutation', async () => {
      render(
        <AppProviders>
          <FailingMutation silent={false} />
        </AppProviders>,
      );

      await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Ya existe un registro con esos datos.',
      );
    });

    it('does not repeat the error of a silent mutation', async () => {
      render(
        <AppProviders>
          <FailingMutation silent />
        </AppProviders>,
      );

      await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

      expect(await screen.findByText('mutation: error')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('manual notices', () => {
    it('shows the message of an ApiError', async () => {
      render(
        <AppProviders>
          <Notifier error={new ApiError(403, 'No tienes permisos.')} />
        </AppProviders>,
      );

      await userEvent.click(screen.getByRole('button', { name: 'Fallar' }));

      expect(screen.getByRole('alert')).toHaveTextContent(
        'No tienes permisos.',
      );
    });

    it('hides the details of unexpected errors', async () => {
      render(
        <AppProviders>
          <Notifier error={new Error('secret internal detail')} />
        </AppProviders>,
      );

      await userEvent.click(screen.getByRole('button', { name: 'Fallar' }));

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Ocurrió un error inesperado.');
      expect(alert).not.toHaveTextContent('secret internal detail');
    });

    it('can be dismissed', async () => {
      render(
        <AppProviders>
          <Notifier error={new ApiError(403, 'No tienes permisos.')} />
        </AppProviders>,
      );
      await userEvent.click(screen.getByRole('button', { name: 'Fallar' }));

      await userEvent.click(
        screen.getByRole('button', { name: 'Cerrar aviso' }),
      );

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('fails loudly when the hook is used outside the provider', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    expect(() => render(<Notifier error={null} />)).toThrow(
      'useErrorNotice must be used inside <AppProviders>',
    );

    consoleError.mockRestore();
  });
});
