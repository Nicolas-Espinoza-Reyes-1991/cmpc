import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation } from 'react-router';
import { AuthStatusScreen } from '../components/AuthStatusScreen';
import { useAuth } from '../hooks/useAuth';
import { ApiError, getErrorMessage } from '../lib/api-error';
import { loginSchema, type LoginFormValues } from '../lib/login-schema';
import { redirectTarget } from '../lib/redirect';

const WRONG_CREDENTIALS = 'Correo o contraseña incorrectos.';

const FIELDS = ['email', 'password'] as const;
type Field = (typeof FIELDS)[number];

const isField = (name: string): name is Field =>
  FIELDS.some((field) => field === name);

const inputClasses =
  'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-blue-600 focus:outline-2 focus:outline-blue-600 aria-[invalid=true]:border-red-600';

export function LoginPage() {
  const { status, login } = useAuth();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  // Problems that do not belong to one field: wrong credentials, rate limit, network...
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    // Validates when a field loses focus and, once it has an error, on every change.
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  });

  /**
   * This form shows its own errors, so it calls `login` directly: it never
   * reaches the global notice, which only reports TanStack Query operations.
   */
  function showFailure(error: unknown): void {
    if (!(error instanceof ApiError)) {
      setFormError(getErrorMessage(error));
      return;
    }

    if (error.status === 401) {
      setFormError(WRONG_CREDENTIALS);
      // The email stays (it is probably right); the password is cleared and focused.
      resetField('password');
      setFocus('password');
      return;
    }

    // Only the errors of fields this form has; flatMap narrows the name to `Field`.
    const fieldErrors = error.fieldErrors.flatMap(({ field, messages }) =>
      isField(field) ? [{ field, message: messages.join(' ') }] : [],
    );
    if (error.status === 400 && fieldErrors.length > 0) {
      for (const { field, message } of fieldErrors) {
        setError(field, { type: 'server', message });
      }
      return;
    }

    setFormError(error.message);
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login(values);
    } catch (error) {
      showFailure(error);
    }
  });

  // A saved session is being verified: showing the form only to redirect away
  // a moment later would flash it.
  if (status === 'loading') return <AuthStatusScreen state="loading" />;
  // Reached after a successful login too: `login` flips the status and this redirects (A5.1, A5.7).
  if (status === 'authenticated') {
    return <Navigate to={redirectTarget(location.state)} replace />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow">
        <p className="text-sm font-medium text-slate-500">CMPC Libros</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Iniciar sesión
        </h1>

        <form
          onSubmit={(event) => {
            // handleSubmit returns a promise; React only needs the event handled.
            void onSubmit(event);
          }}
          noValidate
          aria-busy={isSubmitting}
          className="mt-6 space-y-5"
        >
          {formError && (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {formError}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700"
            >
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              autoFocus
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'email-error' : undefined}
              className={inputClasses}
              {...register('email')}
            />
            {errors.email && (
              <p id="email-error" className="mt-1 text-sm text-red-700">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700"
            >
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={
                  errors.password ? 'password-error' : undefined
                }
                className={`${inputClasses} pr-20`}
                {...register('password')}
              />
              <button
                type="button"
                aria-pressed={showPassword}
                aria-label="Mostrar contraseña"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute inset-y-0 right-0 mt-1 mb-0 rounded-r-md px-3 text-sm font-medium text-blue-700 hover:text-blue-900 focus:outline-2 focus:outline-blue-600"
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            {errors.password && (
              <p id="password-error" className="mt-1 text-sm text-red-700">
                {errors.password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-blue-700 px-4 py-2 font-medium text-white hover:bg-blue-800 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
          >
            {isSubmitting ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </main>
  );
}
