import iconv from 'iconv-lite';
import { decodeSourceCharset } from '../src/core/sourceCharsetDecode';
import { decodeSourceResponse } from '../src/core/sourceResponse';

test.each(['cp936', 'windows-936', 'cp950', 'windows-950', 'big5-hkscs', 'cn-big5', 'GBK:1987', 'GB18030:2000', 'unicode11utf8', 'UTF-8:1987', 'ucs-2', 'UTF-16LE:1987', 'UTF-16BE:1987', 'cp932', 'windows-31j', 'EUC-JP:1987', 'windows-949', 'EUC-KR:1987'])(
  'decodes the existing %s response alias without iconv', charset => {
    const inputs = [Uint8Array.of(0xff,0xfe,0x00,0xd8,0x81,0x20), Uint8Array.of(0x81,0x30,0x81,0x30), Uint8Array.of(0x88,0x62,0xef,0xbb,0xbf)];
    const expected = inputs.map(bytes => iconv.decode(bytes, charset, {stripBOM:false}));
    const decode = jest.spyOn(iconv, 'decode').mockImplementation(() => { throw new Error('unexpected iconv'); });
    try { expect(inputs.map(bytes => decodeSourceCharset(bytes, charset))).toEqual(expected); }
    finally { decode.mockRestore(); }
  },
);

test.each(['cp936', 'windows-936', 'cp950', 'windows-950', 'big5-hkscs', 'GBK:1987', 'GB18030:2000', 'ucs-2'])(
  'matches %s response fallback for mixed bytes', charset => {
    let seed = 0x12345678;
    for (let iteration = 0; iteration < 1000; iteration++) {
      const bytes = new Uint8Array(iteration % 24);
      for (let index = 0; index < bytes.length; index++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        bytes[index] = seed >>> 24;
      }
      expect(decodeSourceCharset(bytes, charset)).toBe(iconv.decode(bytes, charset, {stripBOM:false}));
    }
  },
);

test.each(['cp936', 'cp950'])('decodes a response declaring %s without iconv', charset => {
  const bytes = new Uint8Array(iconv.encode('正文：中文', charset));
  const decode = jest.spyOn(iconv, 'decode').mockImplementation(() => { throw new Error('unexpected iconv'); });
  try { expect(decodeSourceResponse(bytes, `text/html; charset=${charset}`)).toBe('正文：中文'); }
  finally { decode.mockRestore(); }
});
