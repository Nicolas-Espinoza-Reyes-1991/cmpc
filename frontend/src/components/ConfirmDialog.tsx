import { useEffect, useId, useState } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  /** Text of the confirm button while the action runs. */
  busyLabel: string;
  busy: boolean;
  /** Why the action failed, shown inside the dialog so the user can try again. */
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A confirmation built on the native `<dialog>`: the browser traps the focus
 * inside it, makes the rest of the page inert and closes it with Escape. The
 * dialog only reports what the user chose; it never decides to stay open or
 * close, `open` does.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  busyLabel,
  busy,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // A state, not a ref object: the effect runs again once the element exists.
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [dialog, open]);

  return (
    <dialog
      ref={setDialog}
      aria-labelledby={titleId}
      aria-describedby={messageId}
      // Escape fires `cancel`. While the action runs it must not close the dialog.
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto w-full max-w-md rounded-lg p-6 shadow-xl backdrop:bg-slate-900/50"
    >
      <h2 id={titleId} className="text-lg font-semibold text-slate-900">
        {title}
      </h2>
      <p id={messageId} className="mt-2 text-slate-600">
        {message}
      </p>
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          // The safe choice has the focus when the dialog opens.
          autoFocus
          disabled={busy}
          onClick={onCancel}
          className="rounded-md border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="rounded-md bg-red-700 px-4 py-2 font-medium text-white hover:bg-red-800 focus:outline-2 focus:outline-offset-2 focus:outline-red-700 disabled:cursor-not-allowed disabled:bg-red-400"
        >
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
