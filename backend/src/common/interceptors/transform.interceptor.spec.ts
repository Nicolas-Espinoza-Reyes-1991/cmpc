import {
  CallHandler,
  Controller,
  Get,
  INestApplication,
  StreamableFile,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { lastValueFrom, of } from 'rxjs';
import { RawResponse } from '../decorators/raw-response.decorator';
import { PaginatedResult } from '../types/api-response.types';
import { TransformInterceptor } from './transform.interceptor';

const noopHandler = () => undefined;

class PlainController {}

@RawResponse()
class RawController {}

/** Method-level opt-out, applied the same way `@RawResponse()` is on a real handler. */
const rawHandler = () => undefined;
RawResponse()(rawHandler);

function intercept(
  value: unknown,
  { controller = PlainController, handler = noopHandler } = {},
): Promise<unknown> {
  const interceptor = new TransformInterceptor(new Reflector());
  const context = new ExecutionContextHost([], controller, handler);
  const next: CallHandler = { handle: () => of(value) };

  return lastValueFrom(interceptor.intercept(context, next));
}

describe('TransformInterceptor', () => {
  it('wraps a plain object in { data }', async () => {
    await expect(intercept({ id: 1, title: 'Dune' })).resolves.toEqual({
      data: { id: 1, title: 'Dune' },
    });
  });

  it('wraps arrays and primitives in { data }', async () => {
    await expect(intercept([1, 2])).resolves.toEqual({ data: [1, 2] });
    await expect(intercept(42)).resolves.toEqual({ data: 42 });
  });

  it('answers { data: null } when the handler returns nothing', async () => {
    await expect(intercept(undefined)).resolves.toEqual({ data: null });
    await expect(intercept(null)).resolves.toEqual({ data: null });
  });

  it('splits a paginated result into data and meta', async () => {
    const page: PaginatedResult<{ id: number }> = {
      items: [{ id: 1 }, { id: 2 }],
      meta: { page: 1, limit: 10, total: 2 },
    };

    await expect(intercept(page)).resolves.toEqual({
      data: [{ id: 1 }, { id: 2 }],
      meta: { page: 1, limit: 10, total: 2 },
    });
  });

  it.each([
    ['text', 'a string'],
    ['without items', {}],
    ['items that is not an array', { items: 'x', meta: {} }],
    ['items without meta', { items: [1] }],
    ['meta that is not an object', { items: [1], meta: 'x' }],
    ['null meta', { items: [1], meta: null }],
  ])('does not treat %s as a paginated result', async (_label, value) => {
    await expect(intercept(value)).resolves.toEqual({ data: value });
  });

  it('never envelopes a file stream', async () => {
    const file = new StreamableFile(Buffer.from('id,title'));

    await expect(intercept(file)).resolves.toBe(file);
  });

  it('leaves the response untouched when the handler is @RawResponse()', async () => {
    const value = { id: 1 };

    await expect(intercept(value, { handler: rawHandler })).resolves.toBe(
      value,
    );
  });

  it('leaves the response untouched when the controller is @RawResponse()', async () => {
    const value = { id: 1 };

    await expect(intercept(value, { controller: RawController })).resolves.toBe(
      value,
    );
  });
});

@Controller('probe')
class ProbeController {
  @Get('plain')
  plain() {
    return { id: 1 };
  }

  @Get('page')
  page(): PaginatedResult<{ id: number }> {
    return { items: [{ id: 1 }], meta: { page: 1, limit: 10, total: 1 } };
  }

  @Get('nothing')
  nothing(): void {
    return undefined;
  }

  @Get('raw')
  @RawResponse()
  raw() {
    return { id: 99 };
  }
}

describe('TransformInterceptor over HTTP', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalInterceptors(new TransformInterceptor(app.get(Reflector)));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('envelopes a regular response', async () => {
    const res = await request(app.getHttpServer())
      .get('/probe/plain')
      .expect(200);

    expect(res.body).toEqual({ data: { id: 1 } });
  });

  it('exposes meta next to data for listings', async () => {
    const res = await request(app.getHttpServer())
      .get('/probe/page')
      .expect(200);

    expect(res.body).toEqual({
      data: [{ id: 1 }],
      meta: { page: 1, limit: 10, total: 1 },
    });
  });

  it('keeps a data key when nothing is returned', async () => {
    const res = await request(app.getHttpServer())
      .get('/probe/nothing')
      .expect(200);

    expect(res.body).toEqual({ data: null });
  });

  it('skips the envelope for @RawResponse() handlers', async () => {
    const res = await request(app.getHttpServer())
      .get('/probe/raw')
      .expect(200);

    expect(res.body).toEqual({ id: 99 });
  });
});
