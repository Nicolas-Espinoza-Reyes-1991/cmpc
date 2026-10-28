import { ValidationError } from 'class-validator';
import {
  FieldError,
  ValidationException,
} from '../exceptions/validation.exception';

/**
 * Flattens class-validator's tree into one entry per failed field. Nested
 * properties use a dotted path (`publisher.name`) so the form can show them.
 */
export function toFieldErrors(
  errors: ValidationError[],
  parentPath = '',
): FieldError[] {
  return errors.flatMap((error) => {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const own: FieldError[] = error.constraints
      ? [{ field, messages: Object.values(error.constraints) }]
      : [];

    return [...own, ...toFieldErrors(error.children ?? [], field)];
  });
}

/** `exceptionFactory` of the global ValidationPipe (R4.2). */
export function validationExceptionFactory(
  errors: ValidationError[],
): ValidationException {
  return new ValidationException(toFieldErrors(errors));
}
