interface ErrorNoticeProps {
  message: string | null;
  onDismiss: () => void;
}

/** Global error banner. `role="alert"` makes screen readers announce it. */
export function ErrorNotice({ message, onDismiss }: ErrorNoticeProps) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-4 top-4 z-50 mx-auto flex max-w-xl items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-lg"
    >
      <p className="flex-1">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Cerrar aviso"
        className="rounded px-2 text-lg leading-none text-red-700 hover:bg-red-100 focus:outline-2 focus:outline-red-700"
      >
        ×
      </button>
    </div>
  );
}
