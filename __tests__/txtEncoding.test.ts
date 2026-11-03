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

test('decodes UTF-8 TXT and malformed bytes without iconv', () => {
  const decode = jest.spyOn(iconv, 'decode').mockImplementation(() => { throw new Error('unexpected iconv'); });
  const exists = jest.spyOn(iconv, 'encodingExists').mockImplementation(() => { throw new Error('unexpected iconv'); });
  try {
    expect(decodeTxtBase64('77u/5Lit8J+YgOih', 'UTF-8')).toBe('中😀\ufffd');
    expect(decodeTxtBase64('5Lit', 'utf8')).toBe('中');
  } finally { decode.mockRestore(); exists.mockRestore(); }
});

test('removes the same two leading UTF-8 BOMs as the previous TXT decoder', () => {
  expect(decodeTxtBase64('77u/77u/QQ==', 'UTF-8')).toBe('A');
  expect(decodeTxtBase64('77u/77u/77u/QQ==', 'UTF-8')).toBe('\ufeffA');
});

test.each(['UTF-16LE', 'UTF-16BE', 'UCS-2'])(
  'decodes %s TXT without iconv, preserving raw UTF-16 units and ignoring an odd byte', charset => {
    const little = charset !== 'UTF-16BE';
    const bytes = little ? [0xff,0xfe,0xff,0xfe,0x00,0xd8,0x41,0x00,0x7f] : [0xfe,0xff,0xfe,0xff,0xd8,0x00,0x00,0x41,0x7f];
    const expected = iconv.decode(Uint8Array.from(bytes), charset).replace(/^\ufeff/, '');
    const decode = jest.spyOn(iconv, 'decode').mockImplementation(() => { throw new Error('unexpected iconv'); });
    try { expect(decodeTxtBase64(fromByteArray(Uint8Array.from(bytes)), charset)).toBe(expected); }
    finally { decode.mockRestore(); }
  },
);

test.each(['UTF-16LE', 'UTF-16BE'])('matches %s decoding for every two-byte input', charset => {
  const bytes = new Uint8Array(2), differences: number[] = [];
  for (let first = 0; first < 256; first++) {
    bytes[0] = first;
    for (let second = 0; second < 256; second++) {
      bytes[1] = second;
      const expected = iconv.decode(bytes, charset).replace(/^\ufeff/, '');
      if (decodeTxtBase64(fromByteArray(bytes), charset) !== expected && differences.length < 10) differences.push(first * 256 + second);
    }
  }
  expect(differences).toEqual([]);
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
