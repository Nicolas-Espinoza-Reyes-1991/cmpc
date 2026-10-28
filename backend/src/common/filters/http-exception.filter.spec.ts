import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  INestApplication,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { ValidationException } from '../exceptions/validation.exception';
import { HttpExceptionFilter } from './http-exception.filter';

function createHost(headersSent = false) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const end = jest.fn();
  const response = { status, end, headersSent };
  const req = { method: 'GET', path: '/api/books' };
  return { host: new ExecutionContextHost([req, response]), status, json, end };
}

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('prisma failure', {
    code,
    clientVersion: 'test',
  });
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let logError: jest.SpyInstance;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('HttpException', () => {
    it('keeps the status and message of a Nest exception', () => {
      const { host, status, json } = createHost();

      filter.catch(new NotFoundException('Book not found'), host);

      expect(status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith({
        statusCode: 404,
        message: 'Book not found',
        path: '/api/books',
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) as string,
      });
      expect(logError).not.toHaveBeenCalled();
    });

    it('supports a plain string response', () => {
      const { host, status, json } = createHost();

      filter.catch(new HttpException('I am a teapot', 418), host);

      expect(status).toHaveBeenCalledWith(418);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'I am a teapot' }),
      );
    });

    it('joins the messages of Nest default validation errors', () => {
      const { host, json } = createHost();

      filter.catch(
        new BadRequestException([
          'title is required',
          'price must be positive',
        ]),
        host,
      );

      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'title is required; price must be positive',
        }),
      );
    });

    it('falls back to the exception message when the body has none', () => {
      const { host, json } = createHost();

      filter.catch(new HttpException({ code: 'X' }, 400), host);

      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Http Exception' }),
      );
    });

    it('keeps the message of a 5xx Nest exception and logs it', () => {
      const { host, status, json } = createHost();

      filter.catch(
        new ServiceUnavailableException('Database unavailable'),
        host,
      );

      expect(status).toHaveBeenCalledWith(503);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Database unavailable' }),
      );
      expect(logError).toHaveBeenCalledTimes(1);
    });
  });

  describe('ValidationException', () => {
    it('answers 400 with one entry per failed field', () => {
      const { host, status, json } = createHost();
      const errors = [
        { field: 'title', messages: ['title should not be empty'] },
        {
          field: 'price',
          messages: ['price must be positive', 'price is NaN'],
        },
      ];

      filter.catch(new ValidationException(errors), host);

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Validation failed', errors }),
      );
    });
  });

  describe('Prisma known errors', () => {
    it('maps P2025 (record not found) to 404', () => {
      const { host, status, json } = createHost();

      filter.catch(prismaError('P2025'), host);

      expect(status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Resource not found' }),
      );
    });

    it('maps P2002 (unique violation) to 409', () => {
      const { host, status, json } = createHost();

      filter.catch(prismaError('P2002'), host);

      expect(status).toHaveBeenCalledWith(409);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Resource already exists' }),
      );
    });

    it('treats any other Prisma code as an internal error', () => {
      const { host, status, json } = createHost();

      filter.catch(prismaError('P2003'), host);

      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Internal server error' }),
      );
    });
  });

  describe('unexpected errors', () => {
    it('answers a generic 500 and never leaks internals', () => {
      const { host, status, json } = createHost();

      filter.catch(new Error('connection to db with password hunter2'), host);

      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith({
        statusCode: 500,
        message: 'Internal server error',
        path: '/api/books',
        timestamp: expect.any(String) as string,
      });
    });

    it('logs the real cause with its stack', () => {
      const { host } = createHost();
      const cause = new Error('boom');

      filter.catch(cause, host);

      expect(logError).toHaveBeenCalledWith(
        expect.stringContaining('GET /api/books failed with 500'),
        cause.stack,
      );
    });

    it('handles values that are not Error instances', () => {
      const { host, status } = createHost();

      filter.catch('something odd', host);

      expect(status).toHaveBeenCalledWith(500);
      expect(logError).toHaveBeenCalledWith(
        expect.any(String) as string,
        'something odd',
      );
    });
  });

  it('only closes the response when headers were already sent', () => {
    const { host, status, json, end } = createHost(true);

    filter.catch(new Error('late failure'), host);

    expect(end).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
  });
});

@Controller('probe')
class ProbeController {
  @Get('missing')
  missing(): never {
    throw new NotFoundException('Book not found');
  }

  @Get('invalid')
  invalid(): never {
    throw new ValidationException([
      { field: 'title', messages: ['title should not be empty'] },
    ]);
  }

  @Get('boom')
  boom(): never {
    throw new Error('secret internal detail');
  }
}

describe('HttpExceptionFilter over HTTP', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  it('returns the unified shape and omits the query string from path', async () => {
    const res = await request(app.getHttpServer())
      .get('/probe/missing?token=abc')
      .expect(404);

    expect(res.body).toEqual({
      statusCode: 404,
      message: 'Book not found',
      path: '/probe/missing',
      timestamp: expect.any(String) as string,
    });
  });

  it('includes the field errors of a validation failure', async () => {
    const res = await request(app.getHttpServer())
      .get('/probe/invalid')
      .expect(400);

    expect(res.body).toMatchObject({
      message: 'Validation failed',
      errors: [{ field: 'title', messages: ['title should not be empty'] }],
    });
  });

  it('hides the cause of an unexpected error', async () => {
    const res = await request(app.getHttpServer())
      .get('/probe/boom')
      .expect(500);

    expect(res.body).toMatchObject({ message: 'Internal server error' });
    expect(JSON.stringify(res.body)).not.toContain('secret internal detail');
  });
});
