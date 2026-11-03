import iconv from 'iconv-lite';
import { encodeJavaFormValue } from '../src/core/sourceUrlEncoding';

test('encodes Big5 source values without calling iconv', () => {
  const encode = jest.spyOn(iconv, 'encode').mockImplementation(() => { throw new Error('unexpected iconv'); });
  try {
    expect(encodeJavaFormValue('中文 Ê\u0304', 'BIG5')).toBe('%A4%A4%A4%E5+%88%62');
    expect(encodeJavaFormValue('中文', 'big5-hkscs')).toBe('%A4%A4%A4%E5');
  } finally { encode.mockRestore(); }
});

test('preserves Big5 URL form bytes for mixed and malformed text', () => {
  const input = '中文Ê\u0304ê\u030c𠀡\ud800😀';
  const normalized = input.replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, '?');
  const expected = [...iconv.encode(normalized, 'BIG5')].map(byte => `%${byte.toString(16).toUpperCase().padStart(2, '0')}`).join('');
  expect(encodeJavaFormValue(input, 'BIG5')).toBe(expected);
});
