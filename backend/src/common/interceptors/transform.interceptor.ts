import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import { RAW_RESPONSE_KEY } from '../decorators/raw-response.decorator';
import { PaginatedResult } from '../types/api-response.types';

/**
 * A listing service returns `{ items, meta }`. Any other object with an
 * `items` property (e.g. a book payload) must not be mistaken for one, so
 * `meta` has to be present too.
 */
function isPaginatedResult(value: unknown): value is PaginatedResult<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'items' in value &&
    Array.isArray(value.items) &&
    'meta' in value &&
    typeof value.meta === 'object' &&
    value.meta !== null
  );
}

/**
 * Wraps successful responses in `{ data }` or `{ data, meta }` (R5.1) so the
 * frontend reads every endpoint the same way.
 */
@Injectable()
export class TransformInterceptor implements NestInterceptor<unknown, unknown> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isRaw = this.reflector.getAllAndOverride<boolean | undefined>(
      RAW_RESPONSE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isRaw) return next.handle();

    return next.handle().pipe(map((value: unknown) => this.wrap(value)));
  }

  private wrap(value: unknown): unknown {
    // File streams are never enveloped, even if the handler forgot @RawResponse().
    if (value instanceof StreamableFile) return value;

    if (isPaginatedResult(value)) {
      return { data: value.items, meta: value.meta };
    }

    // Handlers that return nothing still answer with a `data` key.
    return { data: value ?? null };
  }
}
