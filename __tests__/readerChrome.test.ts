import { readerChromeColors } from '../src/core/readerChrome';

test('selects application or page colors for reader controls', () => {
  const page = { background: '#111111', foreground: '#eeeeee' };
  const app = { background: '#ffffff', foreground: '#222222' };
  expect(readerChromeColors(false, page, app)).toBe(app);
  expect(readerChromeColors(true, page, app)).toBe(page);
});
