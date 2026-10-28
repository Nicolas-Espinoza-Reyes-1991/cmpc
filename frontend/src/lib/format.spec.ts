import { formatDateTime, formatPrice } from './format';

/** Intl may put a non-breaking space where the output shows a plain one. */
const plain = (text: string) => text.replace(/\s/g, ' ');

describe('formatPrice', () => {
  it.each([
    [12990, '$12.990'],
    [0, '$0'],
    [99_999_999, '$99.999.999'],
    [9990.5, '$9.990,50'],
    [0.01, '$0,01'],
    [1234.56, '$1.234,56'],
  ])('formats %s as Chilean pesos', (price, expected) => {
    expect(plain(formatPrice(price))).toBe(expected);
  });
});

describe('formatDateTime', () => {
  it('formats an ISO moment as day-month-year with the time', () => {
    const text = plain(formatDateTime('2026-10-28T10:30:00.000Z', 'UTC'));

    expect(text).toMatch(/^28-10-2026, 10:30/);
  });

  it('uses the given time zone', () => {
    const utc = formatDateTime('2026-10-28T23:30:00.000Z', 'UTC');
    const tokyo = formatDateTime('2026-10-28T23:30:00.000Z', 'Asia/Tokyo');

    expect(utc).toMatch(/^28-10-2026/);
    expect(tokyo).toMatch(/^29-10-2026/);
  });
});
