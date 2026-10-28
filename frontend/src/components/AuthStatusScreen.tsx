type AuthStatusScreenProps =
  | { state: 'loading' }
  | { state: 'error'; message?: string; onRetry: () => void };

/** Full-screen state shown while the saved session is being checked, or could not be. */
export function AuthStatusScreen(props: AuthStatusScreenProps) {
  if (props.state === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
        <p role="status" className="flex items-center gap-3 text-slate-600">
          <span
            aria-hidden="true"
            className="size-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700"
          />
          Verificando sesión…
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
      <div
        role="alert"
        className="max-w-md rounded-md border border-red-200 bg-red-50 p-6 text-red-800"
      >
        <h1 className="text-lg font-semibold">
          No pudimos verificar tu sesión
        </h1>
        {props.message && <p className="mt-2 text-sm">{props.message}</p>}
        <button
          type="button"
          onClick={props.onRetry}
          className="mt-4 rounded bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 focus:outline-2 focus:outline-offset-2 focus:outline-red-700"
        >
          Reintentar
        </button>
      </div>
    </main>
  );
}
