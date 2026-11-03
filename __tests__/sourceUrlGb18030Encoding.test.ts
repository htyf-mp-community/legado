import iconv from 'iconv-lite';
import { encodeJavaFormValue } from '../src/core/sourceUrlEncoding';
import { encodeSourceGb18030 } from '../src/core/sourceGb18030Encoding';

test('encodes GB18030 source values without iconv', () => {
  const encode = jest.spyOn(iconv, 'encode').mockImplementation(() => { throw new Error('unexpected iconv'); });
  try {
    expect(encodeJavaFormValue('中文𠀀', 'GB18030')).toBe('%D6%D0%CE%C4%95%32%82%36');
    expect(encodeJavaFormValue('😀€', 'gb18030')).toBe('%94%39%FC%36%A2%E3');
  } finally { encode.mockRestore(); }
});

test('matches the previous GB18030 form encoder across all Unicode scalar values', () => {
  const differences: string[] = [];
  for (let code = 0; code <= 0x10ffff; code++) {
    if (code >= 0xd800 && code <= 0xdfff) continue;
    const char = String.fromCodePoint(code), bytes = iconv.encode(char, 'GB18030');
    const expected = /^[a-zA-Z0-9*._-]$/.test(char) ? char : char === ' ' ? '+' : [...bytes].map(b => `%${b.toString(16).toUpperCase().padStart(2, '0')}`).join('');
    const actual = encodeJavaFormValue(char, 'GB18030');
    if (actual !== expected && differences.length < 10) differences.push(`${code.toString(16)}: ${actual} != ${expected}`);
  }
  expect(differences).toEqual([]);
  expect(encodeJavaFormValue('\ud800x\udc00😀', 'GB18030')).toBe('%3Fx%3F%94%39%FC%36');
});

test('matches previous GB18030 encoding on mixed and malformed strings', () => {
  const characters = ['\u0080', '\ue7c7', '€', '中', '文', 'a', '\u0000', '𠀀', '😀', '\ud800', '\udc00', '\ufffd'];
  let seed = 0x12345678;
  for (let iteration = 0; iteration < 20000; iteration++) {
    let value = '';
    for (let index = 0; index < 1 + iteration % 12; index++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      value += characters[seed % characters.length];
    }
    const normalized = value.replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, '?');
    expect(encodeSourceGb18030(value)).toEqual([...iconv.encode(normalized, 'GB18030')]);
  }
});
