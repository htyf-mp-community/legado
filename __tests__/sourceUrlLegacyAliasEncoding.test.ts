import iconv from 'iconv-lite';
import { encodeJavaFormValue } from '../src/core/sourceUrlEncoding';

test.each(['x-gbk', 'GBK:1987', 'ms936', 'GB2312', 'chinese', 'GB18030:2000', 'csbig5', 'BIG5:1987', 'cp950', 'windows-950'])(
  'encodes %s using the previous alias-specific bytes without iconv', charset => {
    const value = '€\ue7c7中文😀';
    const expected = [...iconv.encode(value, charset)].map(byte => `%${byte.toString(16).toUpperCase().padStart(2, '0')}`).join('');
    const encode = jest.spyOn(iconv, 'encode').mockImplementation(() => { throw new Error('unexpected iconv'); });
    try { expect(encodeJavaFormValue(value, charset)).toBe(expected); }
    finally { encode.mockRestore(); }
  },
);

test.each(['x-gbk', 'GB2312', 'cp950'])(
  'matches %s for BMP and unpaired UTF-16 values', charset => {
    const value = Array.from({length:0x10000 - 0x80}, (_, index) => String.fromCharCode(index + 0x80)).join('');
    const normalized = value.replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, '?');
    const expected = [...iconv.encode(normalized, charset)].map(byte => `%${byte.toString(16).toUpperCase().padStart(2, '0')}`).join('');
    expect(encodeJavaFormValue(value, charset)).toBe(expected);
  },
);

test.each(['x-gbk', 'GB2312', 'cp950'])(
  'matches %s on mixed Unicode including GBK buffer boundaries', charset => {
    const characters = ['€','\ue7c7','中','文','Ê','ê','\u0304','\u030c','😀','𠀀','\ud800','\udc00'];
    let seed = 0x12345678;
    for (let iteration = 0; iteration < 10000; iteration++) {
      let value = '';
      for (let index = 0; index < 1 + iteration % 12; index++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        value += characters[seed % characters.length];
      }
      const normalized = value.replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, '?');
      const expected = [...iconv.encode(normalized, charset)].map(byte => `%${byte.toString(16).toUpperCase().padStart(2, '0')}`).join('');
      expect(encodeJavaFormValue(value, charset)).toBe(expected);
    }
  },
);
