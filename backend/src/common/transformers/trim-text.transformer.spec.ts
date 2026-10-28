import { trimText } from './trim-text.transformer';

describe('trimText', () => {
  it.each([
    ['  Dune  ', 'Dune'],
    ['Gabriel   García \t Márquez', 'Gabriel García Márquez'],
    ['line\nbreak', 'line break'],
    ['   ', ''],
    ['', ''],
  ])('turns %j into %j', (value, expected) => {
    expect(trimText({ value })).toBe(expected);
  });

  it.each([[42], [null], [undefined], [true], [{ a: 1 }]])(
    'leaves %j alone so the validators reject it',
    (value) => {
      expect(trimText({ value })).toBe(value);
    },
  );
});
