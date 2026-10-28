import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import {
  FieldError,
  ValidationException,
} from '../exceptions/validation.exception';

/** Single error contract of the API (R4.1). */
export interface ErrorResponseBody {
  statusCode: number;
  message: string;
  errors?: FieldError[];
  path: string;
  timestamp: string;
}

interface ErrorDetails {
  statusCode: number;
  message: string;
  errors?: FieldError[];
}

const INTERNAL_ERROR_MESSAGE = 'Internal server error';
const FIRST_SERVER_ERROR_STATUS = 500;

/**
 * Catches everything and answers with the same error shape. Internal details
 * of unexpected errors are logged but never sent to the client (R4.3).
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const details = this.toErrorDetails(exception);

    if (details.statusCode >= FIRST_SERVER_ERROR_STATUS) {
      this.logger.error(
        `${request.method} ${request.path} failed with ${details.statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    // Too late to send a JSON body (e.g. a CSV stream already started): just close it.
    if (response.headersSent) {
      response.end();
      return;
    }

    const body: ErrorResponseBody = {
      ...details,
      // `path` instead of `url` so query strings (which may carry tokens) are not echoed.
      path: request.path,
      timestamp: new Date().toISOString(),
    };
    response.status(details.statusCode).json(body);
  }

  private toErrorDetails(exception: unknown): ErrorDetails {
    if (exception instanceof ValidationException) {
      return {
        statusCode: exception.getStatus(),
        message: 'Validation failed',
        errors: exception.errors,
      };
    }

    if (exception instanceof HttpException) {
      return {
        statusCode: exception.getStatus(),
        message: this.messageFrom(exception),
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = this.fromPrismaCode(exception.code);
      if (mapped) return mapped;
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: INTERNAL_ERROR_MESSAGE,
    };
  }

  /** Extracts a readable message from the different shapes Nest uses for HttpException. */
  private messageFrom(exception: HttpException): string {
    const body = exception.getResponse();
    if (typeof body === 'string') return body;

    const message: unknown = 'message' in body ? body.message : undefined;
    if (typeof message === 'string') return message;
    // Nest's default ValidationPipe answers with an array of plain messages.
    if (Array.isArray(message)) return message.map(String).join('; ');

    return exception.message;
  }

  private fromPrismaCode(code: string): ErrorDetails | undefined {
    switch (code) {
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Resource not found',
        };
      case 'P2002':
        return {
          statusCode: HttpStatus.CONFLICT,
          message: 'Resource already exists',
        };
      default:
        return undefined;
    }
  }
}
