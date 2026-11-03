import iconv from 'iconv-lite';
import { encodeJavaFormValue } from '../src/core/sourceUrlEncoding';
import { encodeEastAsian } from '../src/core/eastAsianEncoding';

test.each(['SHIFT_JIS', 'EUC-JP', 'EUC-KR', 'windows-949', 'cp932'])(
  'encodes %s book-source text without iconv', charset => {
    const value = '漢字日本語한글😀', bytes = iconv.encode(value, charset);
    const expected = [...bytes].map(byte => `%${byte.toString(16).toUpperCase().padStart(2, '0')}`).join('');
    const encode = jest.spyOn(iconv, 'encode').mockImplementation(() => { throw new Error('unexpected iconv'); });
    try { expect(encodeJavaFormValue(value, charset)).toBe(expected); }
    finally { encode.mockRestore(); }
  },
);

test.each(['SHIFT_JIS', 'EUC-JP', 'EUC-KR'])('matches %s across BMP and mixed strings', charset => {
  // Call the encoder on only non-ASCII inputs; Java form leaves safe ASCII literal.
  const value = Array.from({length:0x10000 - 0x80}, (_, i) => String.fromCharCode(i + 0x80)).join('');
  const original = value.replace(/[\ud800-\udbff][\udc00-\udfff]|[\ud800-\udfff]/g, '?');
  const encoded = [...iconv.encode(original, charset)].map(byte => `%${byte.toString(16).toUpperCase().padStart(2, '0')}`).join('');
  expect(encodeJavaFormValue(value, charset)).toBe(encoded);
});

test.each([['SHIFT_JIS','SHIFTJIS'], ['EUC-JP','EUCJP'], ['EUC-KR','CP949']] as const)(
  'matches %s on mixed and malformed Unicode strings', (charset, kind) => {
    const characters = ['日','本','漢','あ','한','글','€','😀','\ud800','\udc00','\u0000'];
    let seed = 0x12345678;
    for (let iteration = 0; iteration < 10000; iteration++) {
      let input = '';
      for (let index = 0; index < 1 + iteration % 12; index++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        input += characters[seed % characters.length];
      }
      const normalized = input.replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, '?');
      expect(encodeEastAsian(input, kind)).toEqual([...iconv.encode(normalized, charset)]);
    }
  },
);
