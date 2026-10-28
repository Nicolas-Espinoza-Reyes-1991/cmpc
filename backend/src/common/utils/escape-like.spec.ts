import { escapeLike } from './escape-like';

describe('escapeLike', () => {
  it.each([
    ['plain text', 'plain text'],
    ['a_b', 'a\\_b'],
    ['100%', '100\\%'],
    ['a\\b', 'a\\\\b'],
    ['%_\\', '\\%\\_\\\\'],
    ['', ''],
  ])('turns %j into %j', (text, expected) => {
    expect(escapeLike(text)).toBe(expected);
  });
});
