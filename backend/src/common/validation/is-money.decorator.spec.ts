import { validate } from 'class-validator';
import { IsMoney, isMoney } from './is-money.decorator';

const options = { max: 99_999_999.99 };

describe('isMoney', () => {
  it.each([
    0.01, 0.1, 1, 10.5, 12990, 12990.1, 99.99, 1234567.89, 99_999_999.99,
  ])('accepts %s', (value) => {
    expect(isMoney(value, options)).toBe(true);
  });

  it.each([
    ['zero', 0],
    ['below one cent', 0.009],
    ['a tiny exponent number', 1e-7],
    ['negative', -1],
    ['three decimals', 10.123],
    ['three decimals that look like two', 10.0049],
    ['above the maximum', 100_000_000],
    ['a huge number', 1e21],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['text', '10'],
    ['null', null],
    ['undefined', undefined],
    ['a boolean', true],
  ])('rejects %s', (_label, value) => {
    expect(isMoney(value, options)).toBe(false);
  });
});

describe('@IsMoney', () => {
  class Probe {
    @IsMoney({ max: 100 })
    price: unknown;
  }

  it('passes a valid amount', async () => {
    const probe = Object.assign(new Probe(), { price: 99.5 });

    expect(await validate(probe)).toHaveLength(0);
  });

  it('names the field and the allowed range in the message', async () => {
    const probe = Object.assign(new Probe(), { price: 101 });

    const errors = await validate(probe);

    expect(errors[0]?.constraints).toEqual({
      isMoney:
        'price must be a number from 0.01 to 100 with at most two decimals',
    });
  });
});
