import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createMemoryRouter,
  RouterProvider,
  type RouteObject,
} from 'react-router';
import { AppProviders } from '../components/AppProviders';
import { setUnauthorizedHandler } from '../lib/api-client';
import { SERVER_FIELD_MESSAGE } from '../lib/api-error';
import { session } from '../lib/session';
import { mockApi, type MockApi, type MockReply } from '../test/mock-api';
import type { LoginResponse } from '../types/auth';
import { LoginPage } from './LoginPage';

const ADMIN = { id: 'id-admin', email: 'admin@cmpc.local' };
const LOGIN_OK: LoginResponse = {
  accessToken: 'fresh-token',
  tokenType: 'Bearer',
  expiresAt: '2026-10-28T10:00:00.000Z',
  user: ADMIN,
};

const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/books', element: <p>books page</p> },
  { path: '/books/42', element: <p>book 42 page</p> },
];

function renderLogin(state?: unknown) {
  const router = createMemoryRouter(routes, {
    initialEntries: [{ pathname: '/login', state }],
  });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

const emailField = () => screen.getByLabelText('Correo electrónico');
const passwordField = () => screen.getByLabelText('Contraseña');
const submitButton = () => screen.getByRole('button', { name: 'Ingresar' });

async function fillAndSubmit(
  email = 'admin@cmpc.local',
  password = 'change-me',
) {
  await userEvent.type(emailField(), email);
  await userEvent.type(passwordField(), password);
  await userEvent.click(submitButton());
}

describe('LoginPage', () => {
  let api: MockApi;
  const loginRequests = () =>
    api.requests.filter((request) => request.url === '/auth/login');

  const mount = (
    login: MockReply | (() => MockReply | Promise<MockReply>) = {
      data: { data: LOGIN_OK },
    },
  ) => {
    api = mockApi({
      'POST /auth/login': login,
      'GET /auth/me': { data: { data: ADMIN } },
    });
  };

  beforeEach(() => {
    localStorage.clear();
    setUnauthorizedHandler(vi.fn());
    mount();
  });

  afterEach(() => {
    api.restore();
    setUnauthorizedHandler();
  });

  describe('the form', () => {
    it('titles the tab «Iniciar sesión · CMPC Libros»', () => {
      renderLogin();

      expect(document.title).toBe('Iniciar sesión · CMPC Libros');
    });

    it('shows the title, both fields and the button', () => {
      renderLogin();

      expect(
        screen.getByRole('heading', { name: 'Iniciar sesión' }),
      ).toBeInTheDocument();
      expect(emailField()).toBeInTheDocument();
      expect(passwordField()).toBeInTheDocument();
      expect(submitButton()).toBeEnabled();
    });

    it('labels every field and asks the browser for the right autocomplete (A6.5)', () => {
      renderLogin();

      expect(emailField()).toHaveAttribute('type', 'email');
      expect(emailField()).toHaveAttribute('autocomplete', 'username');
      expect(passwordField()).toHaveAttribute('type', 'password');
      expect(passwordField()).toHaveAttribute(
        'autocomplete',
        'current-password',
      );
    });

    it('starts with the cursor on the email', () => {
      renderLogin();

      expect(emailField()).toHaveFocus();
    });
  });

  describe('validation (A6.1)', () => {
    it('explains every problem in Spanish when the form is sent empty, without calling the API', async () => {
      renderLogin();

      await userEvent.click(submitButton());

      expect(await screen.findByText('Ingresa tu correo.')).toBeInTheDocument();
      expect(screen.getByText('Ingresa tu contraseña.')).toBeInTheDocument();
      expect(api.requests).toHaveLength(0);
    });

    it('links each message to its field for screen readers (A6.5)', async () => {
      renderLogin();

      await userEvent.click(submitButton());

      await screen.findByText('Ingresa tu correo.');
      expect(emailField()).toHaveAttribute('aria-invalid', 'true');
      expect(emailField()).toHaveAccessibleDescription('Ingresa tu correo.');
      expect(passwordField()).toHaveAttribute('aria-invalid', 'true');
      expect(passwordField()).toHaveAccessibleDescription(
        'Ingresa tu contraseña.',
      );
    });

    it('puts the cursor on the first field with a problem (A6.5)', async () => {
      renderLogin();
      await userEvent.type(emailField(), 'admin@cmpc.local');

      await userEvent.click(submitButton());

      await screen.findByText('Ingresa tu contraseña.');
      expect(passwordField()).toHaveFocus();
    });

    it('validates when a field loses focus and updates as the user fixes it', async () => {
      renderLogin();
      await userEvent.type(emailField(), 'not-an-email');

      await userEvent.tab();
      expect(
        await screen.findByText('Ingresa un correo válido.'),
      ).toBeInTheDocument();

      await userEvent.clear(emailField());
      await userEvent.type(emailField(), 'admin@cmpc.local');
      expect(
        screen.queryByText('Ingresa un correo válido.'),
      ).not.toBeInTheDocument();
    });

    it('rejects a password longer than 128 characters', async () => {
      renderLogin();
      await userEvent.type(emailField(), 'admin@cmpc.local');
      await userEvent.click(passwordField());
      await userEvent.paste('x'.repeat(129));

      await userEvent.click(submitButton());

      expect(
        await screen.findByText(
          'La contraseña no puede superar los 128 caracteres.',
        ),
      ).toBeInTheDocument();
      expect(api.requests).toHaveLength(0);
    });
  });

  describe('a successful login (A5.1)', () => {
    it('sends the credentials, with the email trimmed, and shows /books', async () => {
      renderLogin();

      await fillAndSubmit('  admin@cmpc.local  ', 'change-me');

      expect(await screen.findByText('books page')).toBeInTheDocument();
      expect(loginRequests()).toHaveLength(1);
      expect(JSON.parse(loginRequests()[0]?.data as string)).toEqual({
        email: 'admin@cmpc.local',
        password: 'change-me',
      });
    });

    it('keeps the session and does not ask /auth/me again', async () => {
      renderLogin();

      await fillAndSubmit();
      await screen.findByText('books page');

      expect(session.getToken()).toBe('fresh-token');
      expect(api.requests.filter((r) => r.url === '/auth/me')).toHaveLength(0);
    });

    it('goes back to the page the user was trying to open', async () => {
      renderLogin({ from: '/books/42' });

      await fillAndSubmit();

      expect(await screen.findByText('book 42 page')).toBeInTheDocument();
    });

    it.each([
      ['a protocol-relative URL', '//evil.test'],
      ['an absolute URL', 'https://evil.test/steal'],
      ['a backslash variant', '/\\evil.test'],
      ['the login itself', '/login'],
    ])('ignores %s as destination and shows /books', async (_label, from) => {
      renderLogin({ from });

      await fillAndSubmit();

      expect(await screen.findByText('books page')).toBeInTheDocument();
    });

    it('never stores the password anywhere in the browser (A6.6)', async () => {
      renderLogin();

      await userEvent.type(passwordField(), 'my-secret-password');
      expect(JSON.stringify({ ...localStorage })).not.toContain('my-secret');

      await userEvent.type(emailField(), 'admin@cmpc.local');
      await userEvent.click(submitButton());
      await screen.findByText('books page');

      expect(Object.keys(localStorage)).toEqual(['cmpc.token']);
      expect(
        JSON.stringify({ ...localStorage, ...sessionStorage }),
      ).not.toContain('my-secret');
    });
  });

  describe('refused credentials (A6.2)', () => {
    beforeEach(() => {
      api.restore();
      mount({ status: 401, data: { message: 'Invalid credentials' } });
    });

    it('says so under the form and stays on the login', async () => {
      const router = renderLogin();

      await fillAndSubmit('admin@cmpc.local', 'wrong');

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Correo o contraseña incorrectos.',
      );
      expect(router.state.location.pathname).toBe('/login');
      expect(session.getToken()).toBeNull();
    });

    it('keeps the email, clears the password and puts the cursor on it', async () => {
      renderLogin();

      await fillAndSubmit('admin@cmpc.local', 'wrong');
      await screen.findByRole('alert');

      expect(emailField()).toHaveValue('admin@cmpc.local');
      expect(passwordField()).toHaveValue('');
      expect(passwordField()).toHaveFocus();
    });

    it('is the only alert: the global notice does not repeat it (A6.3)', async () => {
      renderLogin();

      await fillAndSubmit('admin@cmpc.local', 'wrong');
      await screen.findByRole('alert');

      expect(screen.getAllByRole('alert')).toHaveLength(1);
    });

    it('lets the user try again and clears the message', async () => {
      renderLogin();
      await fillAndSubmit('admin@cmpc.local', 'wrong');
      await screen.findByRole('alert');
      api.restore();
      mount();

      await userEvent.type(passwordField(), 'change-me');
      await userEvent.click(submitButton());

      expect(await screen.findByText('books page')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('other failures show the message of the error (A6.2)', () => {
    it.each([
      [
        'the rate limit (429)',
        { status: 429, data: {} },
        'Demasiados intentos',
      ],
      [
        'a network failure',
        { network: true },
        'No se pudo conectar con el servidor',
      ],
      [
        'a server error (500)',
        { status: 500, data: {} },
        'error en el servidor',
      ],
    ])('for %s', async (_label, reply, expected) => {
      api.restore();
      mount(reply);
      renderLogin();

      await fillAndSubmit();

      expect(await screen.findByRole('alert')).toHaveTextContent(expected);
      expect(screen.getAllByRole('alert')).toHaveLength(1);
    });

    it('keeps what the user typed', async () => {
      api.restore();
      mount({ status: 429, data: {} });
      renderLogin();

      await fillAndSubmit('admin@cmpc.local', 'change-me');
      await screen.findByRole('alert');

      expect(emailField()).toHaveValue('admin@cmpc.local');
      expect(passwordField()).toHaveValue('change-me');
    });

    it('reports a browser that refuses to store the token (full storage, private mode) with the generic message', async () => {
      // The credentials are accepted, then saving the session throws a browser error, not an ApiError.
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException(
          'The quota has been exceeded.',
          'QuotaExceededError',
        );
      });
      renderLogin();

      await fillAndSubmit();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Ocurrió un error inesperado.',
      );
      expect(screen.queryByText('books page')).not.toBeInTheDocument();
      expect(submitButton()).toBeEnabled();
      vi.restoreAllMocks();
    });
  });

  describe('server errors per field (400)', () => {
    it('shows them under the field they belong to', async () => {
      api.restore();
      mount({
        status: 400,
        data: {
          message: 'Validation failed',
          errors: [{ field: 'email', messages: ['email must be an email'] }],
        },
      });
      renderLogin();

      await fillAndSubmit();

      expect(await screen.findByText(SERVER_FIELD_MESSAGE)).toBeInTheDocument();
      expect(screen.queryByText(/must be an email/)).not.toBeInTheDocument();
      expect(emailField()).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('falls back to a general message for fields the form does not have', async () => {
      api.restore();
      mount({
        status: 400,
        data: {
          message: 'Validation failed',
          errors: [
            {
              field: 'isAdmin',
              messages: ['property isAdmin should not exist'],
            },
          ],
        },
      });
      renderLogin();

      await fillAndSubmit();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Los datos enviados no son válidos.',
      );
    });

    it('falls back to a general message when the 400 has no field errors', async () => {
      api.restore();
      mount({ status: 400, data: { message: 'Bad request' } });
      renderLogin();

      await fillAndSubmit();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Los datos enviados no son válidos.',
      );
    });
  });

  describe('while the request is in flight (A6.4)', () => {
    it('disables the button, says "Ingresando…" and sends only one request', async () => {
      let finish!: (reply: MockReply) => void;
      const answer = new Promise<MockReply>((resolve) => {
        finish = resolve;
      });
      api.restore();
      mount(() => answer);
      renderLogin();
      await userEvent.type(emailField(), 'admin@cmpc.local');
      await userEvent.type(passwordField(), 'change-me');

      await userEvent.click(submitButton());

      const busy = await screen.findByRole('button', { name: 'Ingresando…' });
      expect(busy).toBeDisabled();
      await userEvent.click(busy);
      await userEvent.type(passwordField(), '{enter}');
      expect(loginRequests()).toHaveLength(1);

      await act(async () => {
        finish({ data: { data: LOGIN_OK } });
        await Promise.resolve();
      });
      expect(await screen.findByText('books page')).toBeInTheDocument();
    });

    it('enables the button again after a failure', async () => {
      api.restore();
      mount({ status: 401, data: {} });
      renderLogin();

      await fillAndSubmit('admin@cmpc.local', 'wrong');
      await screen.findByRole('alert');

      expect(submitButton()).toBeEnabled();
    });
  });

  describe('showing the password (A6.5)', () => {
    it('toggles between hidden and visible, announcing the state', async () => {
      renderLogin();
      const toggle = screen.getByRole('button', { name: 'Mostrar contraseña' });
      expect(passwordField()).toHaveAttribute('type', 'password');
      expect(toggle).toHaveAttribute('aria-pressed', 'false');

      await userEvent.click(toggle);

      expect(passwordField()).toHaveAttribute('type', 'text');
      expect(toggle).toHaveAttribute('aria-pressed', 'true');
      expect(toggle).toHaveTextContent('Ocultar');

      await userEvent.click(toggle);

      expect(passwordField()).toHaveAttribute('type', 'password');
      expect(toggle).toHaveAttribute('aria-pressed', 'false');
      expect(toggle).toHaveTextContent('Mostrar');
    });

    it('does not submit the form when toggled', async () => {
      renderLogin();

      await userEvent.click(
        screen.getByRole('button', { name: 'Mostrar contraseña' }),
      );

      // Nothing is sent. (Leaving the email field does validate it, as with any
      // blur: that is the form's "onTouched" mode, not a submission.)
      expect(api.requests).toHaveLength(0);
    });
  });

  describe('when there is already a saved session (A5.7)', () => {
    it('sends a signed-in user to /books instead of showing the form', async () => {
      session.setToken('saved-token');

      renderLogin();

      expect(await screen.findByText('books page')).toBeInTheDocument();
      expect(
        screen.queryByLabelText('Correo electrónico'),
      ).not.toBeInTheDocument();
    });

    it('sends a signed-in user back to where they were going', async () => {
      session.setToken('saved-token');

      renderLogin({ from: '/books/42' });

      expect(await screen.findByText('book 42 page')).toBeInTheDocument();
    });

    it('waits while the token is verified instead of flashing the form', async () => {
      session.setToken('saved-token');
      let finish!: (reply: MockReply) => void;
      const answer = new Promise<MockReply>((resolve) => {
        finish = resolve;
      });
      api.restore();
      api = mockApi({ 'GET /auth/me': () => answer });

      renderLogin();

      expect(screen.getByRole('status')).toHaveTextContent(
        'Verificando sesión…',
      );
      expect(
        screen.queryByLabelText('Correo electrónico'),
      ).not.toBeInTheDocument();
      await act(async () => {
        finish({ data: { data: ADMIN } });
        await Promise.resolve();
      });
      expect(await screen.findByText('books page')).toBeInTheDocument();
    });

    it('shows the form when the saved token turns out to be invalid', async () => {
      session.setToken('expired-token');
      api.restore();
      api = mockApi({ 'GET /auth/me': { status: 401, data: {} } });

      renderLogin();

      expect(
        await screen.findByLabelText('Correo electrónico'),
      ).toBeInTheDocument();
    });

    it('shows the form when the token cannot be verified, so the user can sign in again', async () => {
      session.setToken('saved-token');
      api.restore();
      api = mockApi({ 'GET /auth/me': { status: 500, data: {} } });

      renderLogin();

      expect(
        await screen.findByLabelText('Correo electrónico'),
      ).toBeInTheDocument();
    });
  });
});
