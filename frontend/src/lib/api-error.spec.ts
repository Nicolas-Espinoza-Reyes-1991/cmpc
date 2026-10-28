import { AxiosError, type AxiosResponse } from 'axios';
import {
  ApiError,
  NO_RESPONSE_STATUS,
  messageForStatus,
  toApiError,
} from './api-error';

function axiosErrorWith(status: number, data: unknown): AxiosError {
  const response = {
    status,
    data,
    statusText: '',
    headers: {},
    config: {},
  } as AxiosResponse; // test double: only the fields the code reads are filled in
  return new AxiosError(
    'Request failed',
    AxiosError.ERR_BAD_REQUEST,
    undefined,
    null,
    response,
  );
}

describe('messageForStatus', () => {
  it.each([
    [NO_RESPONSE_STATUS, 'No se pudo conectar con el servidor'],
    [400, 'Los datos enviados no son válidos'],
    [401, 'Credenciales inválidas o sesión expirada'],
    [403, 'No tienes permisos'],
    [404, 'No se encontró el recurso'],
    [409, 'Ya existe un registro'],
    [413, 'demasiado grandes'],
    [429, 'Demasiados intentos'],
    [500, 'error en el servidor'],
    [503, 'error en el servidor'],
    [418, 'error inesperado'],
  ])('status %i has a Spanish message', (status, fragment) => {
    expect(messageForStatus(status)).toContain(fragment);
  });
});

describe('toApiError', () => {
  it('keeps the status and the field errors of a validation failure', () => {
    const errors = [
      { field: 'title', messages: ['title should not be empty'] },
      { field: 'price', messages: ['price must not be less than 1'] },
    ];

    const apiError = toApiError(
      axiosErrorWith(400, {
        statusCode: 400,
        message: 'Validation failed',
        errors,
      }),
    );

    expect(apiError).toBeInstanceOf(ApiError);
    expect(apiError.status).toBe(400);
    expect(apiError.message).toBe('Los datos enviados no son válidos.');
    expect(apiError.fieldErrors).toEqual(errors);
    expect(apiError.serverMessage).toBe('Validation failed');
  });

  it('never exposes the English server message as the user message', () => {
    const apiError = toApiError(
      axiosErrorWith(404, { statusCode: 404, message: 'Book not found' }),
    );

    expect(apiError.message).toBe('No se encontró el recurso solicitado.');
    expect(apiError.serverMessage).toBe('Book not found');
    expect(apiError.fieldErrors).toEqual([]);
  });

  it('survives a body that does not follow the contract', () => {
    const html = toApiError(axiosErrorWith(502, '<html>Bad gateway</html>'));
    const empty = toApiError(axiosErrorWith(500, null));

    expect(html.status).toBe(502);
    expect(html.serverMessage).toBeUndefined();
    expect(html.message).toContain('error en el servidor');
    expect(empty.status).toBe(500);
  });

  it('ignores malformed field errors instead of trusting them', () => {
    const notAnArray = toApiError(
      axiosErrorWith(400, { message: 'x', errors: 'oops' }),
    );
    const badItems = toApiError(
      axiosErrorWith(400, { message: 'x', errors: [{ field: 1 }] }),
    );
    const badMessages = toApiError(
      axiosErrorWith(400, {
        message: 'x',
        errors: [{ field: 'a', messages: [1] }],
      }),
    );

    expect(notAnArray.fieldErrors).toEqual([]);
    expect(badItems.fieldErrors).toEqual([]);
    expect(badMessages.fieldErrors).toEqual([]);
  });

  it('ignores a message that is not a string', () => {
    const apiError = toApiError(axiosErrorWith(400, { message: ['a', 'b'] }));

    expect(apiError.serverMessage).toBeUndefined();
  });

  it('turns an Axios error without response into a connection error', () => {
    const apiError = toApiError(
      new AxiosError('Network Error', AxiosError.ERR_NETWORK),
    );

    expect(apiError.status).toBe(NO_RESPONSE_STATUS);
    expect(apiError.isNetworkError).toBe(true);
    expect(apiError.message).toContain('No se pudo conectar con el servidor');
  });

  it('wraps anything that is not an Axios error', () => {
    const apiError = toApiError(new TypeError('boom'));

    expect(apiError).toBeInstanceOf(ApiError);
    expect(apiError.message).toBe('Ocurrió un error inesperado.');
    expect(apiError.serverMessage).toBeUndefined();
  });

  it('does not flag a server response as a network error', () => {
    expect(toApiError(axiosErrorWith(500, {})).isNetworkError).toBe(false);
  });
});
