import { Logger } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../types/authenticated-request.types';

type HttpLogSink = Pick<Logger, 'log' | 'warn' | 'error'>;

const CLIENT_ERROR_STATUS = 400;
const SERVER_ERROR_STATUS = 500;

/** Path without the query string: queries may carry tokens and must not reach the logs. */
function pathOf(originalUrl: string): string {
  const queryStart = originalUrl.indexOf('?');
  return queryStart === -1 ? originalUrl : originalUrl.slice(0, queryStart);
}

/**
 * Access log (R5.2): one line per request, `GET /api/books 200 12ms user=<id|anonymous>`.
 *
 * It is a middleware, not an interceptor, on purpose: interceptors run after
 * guards and never see requests rejected with 401 or unknown routes (404), and
 * listening to `finish` gives the final status the exception filter produced.
 * Bodies and headers are never read, so passwords and tokens cannot leak.
 */
export function createHttpLogger(
  logger: HttpLogSink = new Logger('HTTP'),
): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    const startedAt = performance.now();

    res.once('finish', () => {
      const duration = Math.round(performance.now() - startedAt);
      const user = req.user?.id ?? 'anonymous';
      const line = `${req.method} ${pathOf(req.originalUrl)} ${res.statusCode} ${duration}ms user=${user}`;

      if (res.statusCode >= SERVER_ERROR_STATUS) logger.error(line);
      else if (res.statusCode >= CLIENT_ERROR_STATUS) logger.warn(line);
      else logger.log(line);
    });

    next();
  };
}
