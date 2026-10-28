import { ApiError, getErrorMessage } from './api-error';

describe('getErrorMessage', () => {
  it('returns the user message of an ApiError', () => {
    expect(
      getErrorMessage(new ApiError(404, 'No se encontró el recurso.')),
    ).toBe('No se encontró el recurso.');
  });

  it('hides the details of any other error behind a generic message', () => {
    expect(getErrorMessage(new TypeError('x is undefined'))).toBe(
      'Ocurrió un error inesperado.',
    );
    expect(getErrorMessage('boom')).toBe('Ocurrió un error inesperado.');
  });
});
