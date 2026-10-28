import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthStatusScreen } from './AuthStatusScreen';

describe('AuthStatusScreen', () => {
  describe('loading', () => {
    it('announces that the session is being verified', () => {
      render(<AuthStatusScreen state="loading" />);

      expect(screen.getByRole('status')).toHaveTextContent(
        'Verificando sesión…',
      );
    });

    it('offers nothing to click while it waits', () => {
      render(<AuthStatusScreen state="loading" />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('error', () => {
    it('explains the problem as an alert, with the reason', () => {
      render(
        <AuthStatusScreen
          state="error"
          message="No se pudo conectar con el servidor."
          onRetry={vi.fn()}
        />,
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('No pudimos verificar tu sesión');
      expect(alert).toHaveTextContent('No se pudo conectar con el servidor.');
    });

    it('still works without a reason', () => {
      render(<AuthStatusScreen state="error" onRetry={vi.fn()} />);

      expect(screen.getByRole('alert')).toHaveTextContent(
        'No pudimos verificar tu sesión',
      );
    });

    it('lets the user try again', async () => {
      const onRetry = vi.fn();
      render(<AuthStatusScreen state="error" onRetry={onRetry} />);

      await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });
});
