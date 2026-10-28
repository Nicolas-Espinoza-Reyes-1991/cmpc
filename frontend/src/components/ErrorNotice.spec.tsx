import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorNotice } from './ErrorNotice';

describe('ErrorNotice', () => {
  it('renders nothing without a message', () => {
    render(<ErrorNotice message={null} onDismiss={vi.fn()} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('announces the message as an alert', () => {
    render(<ErrorNotice message="No se pudo guardar." onDismiss={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar.');
  });

  it('lets the user dismiss it', async () => {
    const onDismiss = vi.fn();
    render(<ErrorNotice message="Falló." onDismiss={onDismiss} />);

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
