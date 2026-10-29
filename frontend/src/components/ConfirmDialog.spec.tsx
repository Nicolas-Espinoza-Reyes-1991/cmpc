import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from './ConfirmDialog';

type Props = Parameters<typeof ConfirmDialog>[0];

function renderDialog(overrides: Partial<Props> = {}) {
  const props: Props = {
    open: true,
    title: 'Eliminar libro',
    message: '¿Eliminar «Dune»?',
    confirmLabel: 'Eliminar',
    busyLabel: 'Eliminando…',
    busy: false,
    error: null,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  const view = render(<ConfirmDialog {...props} />);
  return { props, ...view };
}

/** What the browser fires when the user presses Escape on a modal dialog. */
const pressEscape = () =>
  fireEvent(
    screen.getByRole('dialog', { hidden: true }),
    new Event('cancel', { cancelable: true }),
  );

describe('ConfirmDialog', () => {
  it('is hidden while closed and shown, with its text, when open', () => {
    const { rerender, props } = renderDialog({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(<ConfirmDialog {...props} open />);

    expect(
      screen.getByRole('dialog', { name: 'Eliminar libro' }),
    ).toHaveAccessibleDescription('¿Eliminar «Dune»?');
  });

  it('closes again when `open` goes back to false', () => {
    const { rerender, props } = renderDialog();
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    rerender(<ConfirmDialog {...props} open={false} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('puts the safe choice first: Cancelar has the focus', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  });

  it('reports the confirmation', async () => {
    const { props } = renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }));

    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onCancel).not.toHaveBeenCalled();
  });

  it('reports the cancellation from the button', async () => {
    const { props } = renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('treats Escape as a cancellation and lets the parent close the dialog', () => {
    const { props } = renderDialog();

    pressEscape();

    expect(props.onCancel).toHaveBeenCalledTimes(1);
    // The parent decides: the dialog stays open until `open` changes.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('prevents the default of Escape so the browser does not close it by itself', () => {
    renderDialog();
    const event = new Event('cancel', { cancelable: true });

    fireEvent(screen.getByRole('dialog'), event);

    expect(event.defaultPrevented).toBe(true);
  });

  describe('while the action runs', () => {
    it('shows the busy label and disables both buttons', () => {
      renderDialog({ busy: true });

      expect(
        screen.getByRole('button', { name: 'Eliminando…' }),
      ).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    });

    it('ignores Escape', () => {
      const { props } = renderDialog({ busy: true });

      pressEscape();

      expect(props.onCancel).not.toHaveBeenCalled();
    });
  });

  it('shows why the action failed, as an alert inside the dialog', () => {
    renderDialog({ error: 'No pudimos eliminar el libro.' });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'No pudimos eliminar el libro.',
    );
  });

  it('shows no alert when there is no error', () => {
    renderDialog();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
