import { isAxiosError } from 'axios';
import type { ErrorResponseBody, FieldError } from '../types/api';

/** Status used when no HTTP response arrived (network down, timeout, CORS...). */
export const NO_RESPONSE_STATUS = 0;

const MESSAGES = {
  noResponse:
    'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
  unexpected: 'Ocurrió un error inesperado.',
  badRequest: 'Los datos enviados no son válidos.',
  unauthorized: 'Credenciales inválidas o sesión expirada.',
  forbidden: 'No tienes permisos para realizar esta acción.',
  notFound: 'No se encontró el recurso solicitado.',
  conflict: 'Ya existe un registro con esos datos.',
  tooLarge: 'El archivo o los datos enviados son demasiado grandes.',
  tooManyRequests:
    'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
  server: 'Ocurrió un error en el servidor. Inténtalo más tarde.',
} as const;

/** The one error type the UI handles, whatever went wrong (R4.6). */
export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: FieldError[];
  /** Raw message sent by the backend (English); for logs, not for users. */
  readonly serverMessage: string | undefined;

  constructor(
    status: number,
    message: string,
    fieldErrors: FieldError[] = [],
    serverMessage?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.serverMessage = serverMessage;
  }

  get isNetworkError(): boolean {
    return this.status === NO_RESPONSE_STATUS;
  }
}

/**
 * Shown under a field the server rejected. The server's own messages are in
 * English (they are the API contract and stay in `serverMessage`). The client
 * schemas check the same rules in Spanish first, so this is reached only when
 * the two disagree, and the user still gets a message in their language.
 */
export const SERVER_FIELD_MESSAGE = 'Este valor no es válido. Revísalo.';

/** User-facing Spanish message for an HTTP status. */
export function messageForStatus(status: number): string {
  switch (status) {
    case NO_RESPONSE_STATUS:
      return MESSAGES.noResponse;
    case 400:
      return MESSAGES.badRequest;
    case 401:
      return MESSAGES.unauthorized;
    case 403:
      return MESSAGES.forbidden;
    case 404:
      return MESSAGES.notFound;
    case 409:
      return MESSAGES.conflict;
    case 413:
      return MESSAGES.tooLarge;
    case 429:
      return MESSAGES.tooManyRequests;
    default:
      return status >= 500 ? MESSAGES.server : MESSAGES.unexpected;
  }
}

/** Message to show for anything that failed; non-API errors get the generic one. */
export function getErrorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : MESSAGES.unexpected;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFieldError(value: unknown): value is FieldError {
  return (
    isRecord(value) &&
    typeof value.field === 'string' &&
    Array.isArray(value.messages) &&
    value.messages.every((message) => typeof message === 'string')
  );
}

/** Reads the backend's error body, ignoring anything that does not match the contract. */
function parseBody(
  data: unknown,
): Pick<Partial<ErrorResponseBody>, 'message' | 'errors'> {
  if (!isRecord(data)) return {};

  return {
    message: typeof data.message === 'string' ? data.message : undefined,
    errors:
      Array.isArray(data.errors) && data.errors.every(isFieldError)
        ? data.errors
        : undefined,
  };
}

/**
 * Turns whatever Axios rejected with into an `ApiError`. Cancellations are not
 * errors and must be handled by the caller before this point.
 */
export function toApiError(error: unknown): ApiError {
  if (!isAxiosError(error)) {
    return new ApiError(NO_RESPONSE_STATUS, MESSAGES.unexpected);
  }

  if (!error.response) {
    return new ApiError(NO_RESPONSE_STATUS, MESSAGES.noResponse);
  }

  const { status } = error.response;
  // Axios types the body as `any`; it is read as `unknown` and validated.
  const body = parseBody(error.response.data as unknown);

  return new ApiError(
    status,
    messageForStatus(status),
    body.errors ?? [],
    body.message,
  );
}
