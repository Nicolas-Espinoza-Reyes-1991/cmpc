import { applyDecorators, HttpStatus, Type } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  getSchemaPath,
} from '@nestjs/swagger';

interface ApiDataResponseOptions {
  description: string;
  /** 200 by default. */
  status?: HttpStatus.OK | HttpStatus.CREATED;
  /** The data is a list of `model`. */
  isArray?: boolean;
}

/**
 * Documents a success response the way it really travels: the
 * `TransformInterceptor` wraps every success as `{ data }`, so describing only
 * the model would show Swagger readers a body the API never sends.
 */
export function ApiDataResponse(
  model: Type<unknown>,
  {
    description,
    status = HttpStatus.OK,
    isArray = false,
  }: ApiDataResponseOptions,
): MethodDecorator {
  const item = { $ref: getSchemaPath(model) };
  const response = {
    description,
    schema: {
      type: 'object',
      required: ['data'],
      properties: { data: isArray ? { type: 'array', items: item } : item },
    },
  };

  return applyDecorators(
    ApiExtraModels(model),
    status === HttpStatus.CREATED
      ? ApiCreatedResponse(response)
      : ApiOkResponse(response),
  );
}
