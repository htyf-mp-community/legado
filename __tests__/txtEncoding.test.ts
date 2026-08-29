import iconv from 'iconv-lite';
import { fromByteArray } from 'react-native-quick-base64';
import { decodeTxtBase64, reSegmentText } from '../src/core/txtEncoding';

jest.mock('react-native-quick-base64', () => ({
  fromByteArray: (bytes: Uint8Array) =>
    (globalThis as unknown as { Buffer: { from(value: Uint8Array): { toString(encoding: string): string } } }).Buffer.from(bytes).toString('base64'),
  toByteArray: (value: string) =>
    new Uint8Array(
      (globalThis as unknown as { Buffer: { from(value: string, encoding: string): Uint8Array } }).Buffer.from(value, 'base64'),
    ),
}));

test('decodes legacy Chinese TXT encodings from original bytes', () => {
  const encoded = iconv.encode('第一章\n你好，世界。', 'gb18030');
  expect(decodeTxtBase64(fromByteArray(encoded), 'GB18030')).toBe(
    '第一章\n你好，世界。',
  );
});

test('repairs broken paragraphs deterministically and omits repeated title', () => {
  expect(
    reSegmentText('第一章\n这是一句没有结束\n的正文。\n“你好！”“欢迎。”', '第一章'),
  ).toBe('这是一句没有结束的正文。\n“你好！”\n“欢迎。”');
});

test('rejects unknown encodings', () => {
  expect(() => decodeTxtBase64('', 'not-a-charset')).toThrow(
    'UNSUPPORTED_CHARSET',
  );
});
