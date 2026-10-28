import { ValidationError } from 'class-validator';
import { ValidationException } from '../exceptions/validation.exception';
import {
  toFieldErrors,
  validationExceptionFactory,
} from './validation-exception.factory';

describe('toFieldErrors', () => {
  it('returns one entry per failed field with all of its messages', () => {
    const errors: ValidationError[] = [
      {
        property: 'title',
        constraints: { isNotEmpty: 'title should not be empty' },
      },
      {
        property: 'price',
        constraints: {
          isInt: 'price must be an integer',
          min: 'price must not be less than 1',
        },
      },
    ];

    expect(toFieldErrors(errors)).toEqual([
      { field: 'title', messages: ['title should not be empty'] },
      {
        field: 'price',
        messages: ['price must be an integer', 'price must not be less than 1'],
      },
    ]);
  });

  it('uses a dotted path for nested properties', () => {
    const errors: ValidationError[] = [
      {
        property: 'publisher',
        children: [
          {
            property: 'name',
            constraints: { isString: 'name must be a string' },
          },
        ],
      },
    ];

    expect(toFieldErrors(errors)).toEqual([
      { field: 'publisher.name', messages: ['name must be a string'] },
    ]);
  });

  it('keeps the errors of a parent and of its children', () => {
    const errors: ValidationError[] = [
      {
        property: 'author',
        constraints: { isObject: 'author must be an object' },
        children: [
          { property: 'id', constraints: { isUuid: 'id must be a UUID' } },
        ],
      },
    ];

    expect(toFieldErrors(errors)).toEqual([
      { field: 'author', messages: ['author must be an object'] },
      { field: 'author.id', messages: ['id must be a UUID'] },
    ]);
  });

  it('returns an empty list when there is nothing to report', () => {
    expect(toFieldErrors([])).toEqual([]);
  });
});

describe('validationExceptionFactory', () => {
  it('builds a ValidationException carrying the field errors', () => {
    const exception = validationExceptionFactory([
      {
        property: 'title',
        constraints: { isString: 'title must be a string' },
      },
    ]);

    expect(exception).toBeInstanceOf(ValidationException);
    expect(exception.getStatus()).toBe(400);
    expect(exception.errors).toEqual([
      { field: 'title', messages: ['title must be a string'] },
    ]);
  });
});
