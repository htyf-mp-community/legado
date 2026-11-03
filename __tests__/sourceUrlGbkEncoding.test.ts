import iconv from 'iconv-lite';
import { encodeJavaFormValue } from '../src/core/sourceUrlEncoding';
import { encodeSourceGbk } from '../src/core/sourceGbkEncoding';

test('encodes Java GBK source values without calling iconv', () => {
  const encode = jest.spyOn(iconv, 'encode').mockImplementation(() => { throw new Error('unexpected iconv'); });
  try {
    expect(encodeJavaFormValue('西游记 €😀', 'GBK')).toBe('%CE%F7%D3%CE%BC%C7+%A2%E3%3F');
    expect(encodeJavaFormValue('头发', 'cp936')).toBe('%CD%B7%B7%A2');
    expect(encodeJavaFormValue('头发', 'windows-936')).toBe('%CD%B7%B7%A2');
  } finally { encode.mockRestore(); }
});

test.each(['GBK', 'cp936', 'windows-936'])('matches the existing %s form encoder for every BMP character', charset => {
  const differences: string[] = [];
  for (let code = 0; code <= 0xffff; code++) {
    if (code >= 0xd800 && code <= 0xdfff) continue;
    const char = String.fromCharCode(code);
    const bytes = code === 0x20ac ? [0xa2, 0xe3] : [...iconv.encode(char, charset)];
    const expected = /^[a-zA-Z0-9*._-]$/.test(char) ? char : char === ' ' ? '+' : bytes.map(b => `%${b.toString(16).toUpperCase().padStart(2, '0')}`).join('');
    const actual = encodeJavaFormValue(char, charset);
    if (actual !== expected && differences.length < 10) differences.push(`${code.toString(16)}: ${actual} != ${expected}`);
  }
  expect(differences).toEqual([]);
  expect(encodeJavaFormValue('\ud800x\udc00😀', charset)).toBe('%3Fx%3F%3F');
});

test('preserves the previous GBK encoder output across adjacent special characters', () => {
  expect(encodeJavaFormValue('\ue7c7中', 'GBK')).toBe('%81%35%F4%37%D6%D0');
  expect(encodeJavaFormValue('中\ue7c7', 'GBK')).toBe('%D6%D0%81%35%F4%37');
  expect(encodeJavaFormValue('\ue7c7\ue7c7', 'GBK')).toBe('%81%35%F4%37%81%35');
  expect(encodeJavaFormValue('\ue7c7€', 'GBK')).toBe('%81%35%F4%A2%E3');
  expect(encodeJavaFormValue('\ue7c7😀', 'GBK')).toBe('%81%35%F4%37%3F');
});

test.each(['GBK', 'CP936'] as const)('matches previous %s encoder on mixed strings', charset => {
  const characters = ['\ue7c7', '€', '中', '文', 'a', '\u0000', '😀', '\ud800', '\udc00', '\ue000', '\ufffd'];
  let seed = 0x12345678;
  for (let iteration = 0; iteration < 10000; iteration++) {
    let value = '';
    for (let index = 0; index < 1 + iteration % 12; index++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      value += characters[seed % characters.length];
    }
    const normalized = value.replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, '?');
    const expected = normalized.split('€').flatMap((part, index) => [...(index ? [0xa2, 0xe3] : []), ...iconv.encode(part, charset)]);
    expect(encodeSourceGbk(value, charset)).toEqual(expected);
  }
});
