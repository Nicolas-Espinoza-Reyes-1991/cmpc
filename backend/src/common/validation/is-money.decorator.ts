import { ValidateBy, ValidationOptions } from 'class-validator';

export interface MoneyOptions {
  /** Largest accepted amount (inclusive). */
  max: number;
}

const SMALLEST_AMOUNT = 0.01;
// Floats carry rounding noise (12990.1 * 100 = 1299010.0000000002); the noise
// grows with the size of the number but stays far below this.
const CENTS_TOLERANCE = 1e-5;

/** True for a finite amount from 0.01 up to `max` with at most two decimals. */
export function isMoney(value: unknown, { max }: MoneyOptions): boolean {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  if (value < SMALLEST_AMOUNT || value > max) return false;
  const cents = value * 100;
  return Math.abs(cents - Math.round(cents)) < CENTS_TOLERANCE;
}

/**
 * An amount of money with at most two decimals. It replaces
 * `@IsNumber({ maxDecimalPlaces })`, which throws a `TypeError` (a 500) for
 * numbers written in exponent form such as `1e-7`, and `@IsPositive`, which
 * would accept amounts that the database rounds down to 0.00.
 */
export function IsMoney(
  options: MoneyOptions,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isMoney',
      constraints: [options],
      validator: {
        validate: (value: unknown) => isMoney(value, options),
        // class-validator replaces `$property` with the field name.
        defaultMessage: () =>
          `$property must be a number from ${SMALLEST_AMOUNT} to ${options.max} with at most two decimals`,
      },
    },
    validationOptions,
  );
}
