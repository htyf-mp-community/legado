import iconv from 'iconv-lite';
import { decodeSourceCharset } from '../src/core/sourceCharsetDecode';

test('matches the existing UTF-8 decoder for every one- and two-byte input', () => {
  for (let first = 0; first < 256; first++) {
    const one = Uint8Array.of(first);
    expect(decodeSourceCharset(one, 'UTF-8')).toBe(iconv.decode(one, 'UTF-8', {stripBOM:false}));
    for (let second = 0; second < 256; second++) {
      const bytes = Uint8Array.of(first, second);
      expect(decodeSourceCharset(bytes, 'utf8')).toBe(iconv.decode(bytes, 'UTF-8', {stripBOM:false}));
    }
  }
});

test('matches UTF-8 decoding for malformed sequences, BOM and scalar boundaries', () => {
  const cases = [
    [0xef,0xbb,0xbf,0x41], [0xe1,0x80,0x41], [0xe0,0x80,0x80], [0xed,0xa0,0x80],
    [0xf0,0x8f,0xbf,0xbf], [0xf4,0x90,0x80,0x80], [0xf0,0xa0,0xae,0xb7], [0xf0,0x9f,0x92],
  ];
  let state = 0x12345678;
  for (let i = 0; i < 10000; i++) {
    const bytes: number[] = [];
    for (let j = 0; j < 8; j++) { state = (Math.imul(state,1664525)+1013904223)>>>0; bytes.push(state >>> 24); }
    cases.push(bytes);
  }
  for (const input of cases) {
    const bytes = Uint8Array.from(input);
    expect(decodeSourceCharset(bytes, 'UTF-8')).toBe(iconv.decode(bytes, 'UTF-8', {stripBOM:false}));
  }
});

test('uses a local UTF-8 decoder rather than invoking iconv', () => {
  const spy = jest.spyOn(iconv, 'decode');
  try {
    expect(decodeSourceCharset(Uint8Array.of(0xe8,0xaf,0xbb), 'UTF-8')).toBe('读');
    expect(spy).not.toHaveBeenCalled();
  } finally { spy.mockRestore(); }
});

test('preserves text and supplementary characters across output chunks', () => {
  const text = 'a'.repeat(4095) + '𠮷' + '西游记'.repeat(10000);
  const bytes = new Uint8Array(iconv.encode(text, 'UTF-8'));
  expect(decodeSourceCharset(bytes, 'UTF-8')).toBe(text);
});
