import { HttpStatus } from '@nestjs/common';
import { ApiDataResponse } from './api-data-response.decorator';

class Model {}

interface RecordedResponse {
  description: string;
  schema: {
    required: string[];
    properties: { data: Record<string, unknown> };
  };
}

/** Applies the decorator to a method and reads back what Swagger will see. */
function documented(options: Parameters<typeof ApiDataResponse>[1]) {
  class Controller {
    @ApiDataResponse(Model, options)
    handler(): void {}
  }
  // eslint-disable-next-line @typescript-eslint/unbound-method -- only its metadata is read, it is never called
  const handler = Controller.prototype.handler;
  return {
    responses: Reflect.getMetadata('swagger/apiResponse', handler) as Record<
      string,
      RecordedResponse
    >,
    extraModels: Reflect.getMetadata('swagger/apiExtraModels', handler) as
      unknown[] | undefined,
  };
}

describe('ApiDataResponse', () => {
  it('describes a success as { data: model } with 200 by default', () => {
    const { responses } = documented({ description: 'The model.' });

    expect(Object.keys(responses)).toEqual(['200']);
    expect(responses['200']?.description).toBe('The model.');
    expect(responses['200']?.schema.required).toEqual(['data']);
    expect(responses['200']?.schema.properties.data).toEqual({
      $ref: '#/components/schemas/Model',
    });
  });

  it('describes a list as an array of the model', () => {
    const { responses } = documented({
      description: 'Models.',
      isArray: true,
    });

    expect(responses['200']?.schema.properties.data).toEqual({
      type: 'array',
      items: { $ref: '#/components/schemas/Model' },
    });
  });

  it('uses 201 for a creation', () => {
    const { responses } = documented({
      description: 'Created.',
      status: HttpStatus.CREATED,
    });

    expect(Object.keys(responses)).toEqual(['201']);
  });

  it('registers the model so its schema is published', () => {
    const { extraModels } = documented({ description: 'x' });

    expect(extraModels).toContain(Model);
  });
});
