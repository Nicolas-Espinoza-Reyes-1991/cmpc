import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { RequestHandler } from 'express';
import helmet from 'helmet';
import { EnvironmentVariables } from './config/env.validation';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { createHttpLogger } from './common/middleware/http-logger.middleware';
import { validationExceptionFactory } from './common/validation/validation-exception.factory';

export const API_PREFIX = 'api';
export const DOCS_PATH = `${API_PREFIX}/docs`;
const JSON_BODY_LIMIT = '100kb';

/** `CORS_ORIGIN` holds a comma-separated list of allowed origins. */
export function parseCorsOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

/**
 * helmet's default Content-Security-Policy would block the inline scripts of
 * Swagger UI, so the docs get every other helmet header but no CSP. The API
 * itself keeps the full default policy.
 */
function securityHeaders(): RequestHandler {
  const apiHeaders = helmet();
  const docsHeaders = helmet({ contentSecurityPolicy: false });

  return (req, res, next) => {
    const isDocs = req.path.startsWith(`/${DOCS_PATH}`);
    (isDocs ? docsHeaders : apiHeaders)(req, res, next);
  };
}

function setupSwagger(app: NestExpressApplication): void {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('CMPC Libros API')
      .setDescription('Inventory API of the CMPC-libros bookstore')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );

  SwaggerModule.setup(DOCS_PATH, app, document, {
    jsonDocumentUrl: `${DOCS_PATH}-json`,
  });
}

/**
 * Applies every global setting of the API. It lives outside `main.ts` so the
 * e2e and unit tests boot the application exactly as production does.
 */
export function configureApp(app: NestExpressApplication): void {
  const config =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  // First, so it also sees requests rejected later on (401, 404...).
  app.use(createHttpLogger());
  app.setGlobalPrefix(API_PREFIX);
  // nginx is the single proxy in front of the API: trusting exactly that hop
  // makes `request.ip` the real client and not the nginx container, which the
  // login rate limit and the audit log rely on (A4.3).
  app.set('trust proxy', 1);
  app.use(securityHeaders());
  app.enableCors({
    origin: parseCorsOrigins(config.get('CORS_ORIGIN', { infer: true })),
    // Lets the browser read the file name of CSV downloads.
    exposedHeaders: ['Content-Disposition'],
  });
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor(app.get(Reflector)));

  setupSwagger(app);
}
