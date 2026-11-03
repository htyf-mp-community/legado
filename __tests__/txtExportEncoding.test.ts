import iconv from 'iconv-lite';
import { encodeTxtExport } from '../src/core/txtExportEncoding';

test.each(['UTF-8', 'UTF-16LE', 'UTF-16BE', 'GBK', 'GB18030', 'BIG5'] as const)(
  'exports %s text without invoking iconv', charset => {
    const value = '第一章\n€\ue7c7 Ê\u0304 ê\u030c 𠀀 😀 \ud800\ud800';
    const expected = [...iconv.encode(value, charset)];
    const encode = jest.spyOn(iconv, 'encode').mockImplementation(() => { throw new Error('unexpected iconv'); });
    try { expect([...encodeTxtExport(value, charset)]).toEqual(expected); }
    finally { encode.mockRestore(); }
  },
);

test('matches previous Big5 encoding for every Unicode scalar value', () => {
  const differences: string[] = [];
  for (let code = 0; code <= 0x10ffff; code++) {
    if (code >= 0xd800 && code <= 0xdfff) continue;
    const value = String.fromCodePoint(code);
    const expected = iconv.encode(value, 'BIG5');
    const actual = encodeTxtExport(value, 'BIG5');
    if ((expected.length !== actual.length || expected.some((byte, index) => byte !== actual[index])) && differences.length < 10)
      differences.push(code.toString(16));
  }
  expect(differences).toEqual([]);
});

test.each(['UTF-8', 'UTF-16LE', 'UTF-16BE', 'GBK', 'GB18030', 'BIG5'] as const)(
  'matches %s bytes on a long book-sized string', charset => {
    const value = '第十二章，中文😀Ê\u0304欧元€\n'.repeat(20000);
    expect(encodeTxtExport(value, charset)).toEqual(new Uint8Array(iconv.encode(value, charset)));
  },
);

test.each(['UTF-8', 'UTF-16LE', 'UTF-16BE', 'GBK', 'GB18030', 'BIG5'] as const)(
  'matches %s encoding across mixed strings and malformed UTF-16', charset => {
    const characters = ['\u0080', '\ue7c7', '€', '中', '文', 'a', '\u0000', '𠀀', '😀', '\ud800', '\udc00', '\ufffd', 'Ê', 'ê', '\u0304', '\u030c'];
    let seed = 0x12345678;
    for (let iteration = 0; iteration < 10000; iteration++) {
      let value = '';
      for (let index = 0; index < 1 + iteration % 12; index++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        value += characters[seed % characters.length];
      }
      expect([...encodeTxtExport(value, charset)]).toEqual([...iconv.encode(value, charset)]);
    }
  },
);
