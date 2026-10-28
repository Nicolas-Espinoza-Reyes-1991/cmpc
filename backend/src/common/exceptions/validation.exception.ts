import { BadRequestException } from '@nestjs/common';

/** One failed field with all of its messages (R4.2). */
export interface FieldError {
  field: string;
  messages: string[];
}

/**
 * Thrown by the global ValidationPipe. Keeping the field errors as a typed
 * property lets the exception filter expose them without guessing the shape.
 */
export class ValidationException extends BadRequestException {
  constructor(public readonly errors: FieldError[]) {
    super({ message: 'Validation failed', errors });
  }
}
