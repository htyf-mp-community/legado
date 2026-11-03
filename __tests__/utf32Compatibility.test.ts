import iconv from 'iconv-lite';
import { decodeTxtBase64 } from '../src/core/txtEncoding';
import { decodeSourceCharset } from '../src/core/sourceCharsetDecode';
import { encodeJavaFormValue } from '../src/core/sourceUrlEncoding';

jest.mock('react-native-quick-base64', () => ({toByteArray: (value: string) => new Uint8Array(Buffer.from(value, 'base64'))}));

test.each(['UTF-32', 'UCS-4', 'UTF-32LE', 'UTF-32BE', 'UCS-4LE', 'UCS-4BE'])(
  'preserves %s TXT and URL semantics without iconv', charset => {
    const input = '中😀\ud800', normalized = '中😀?';
    const encoded = iconv.encode(normalized, charset);
    const expected = [...encoded].map(b => `%${b.toString(16).toUpperCase().padStart(2, '0')}`).join('');
    const bytes = Buffer.from('0000feff0000feff0000d80000000041ff', 'hex');
    const decoded = iconv.decode(bytes, charset).replace(/^\ufeff/, '');
    const spyEncode = jest.spyOn(iconv, 'encode').mockImplementation(() => { throw new Error('unexpected iconv encode'); });
    const spyDecode = jest.spyOn(iconv, 'decode').mockImplementation(() => { throw new Error('unexpected iconv decode'); });
    try {
      expect(encodeJavaFormValue(input, charset)).toBe(expected);
      expect(decodeTxtBase64(bytes.toString('base64'), charset)).toBe(decoded);
    } finally { spyEncode.mockRestore(); spyDecode.mockRestore(); }
  },
);

test.each(['UCS-4', 'UCS-4LE', 'UCS-4BE', 'UTF-32:1987', 'UTF-32LE:1987', 'UTF-32BE:1987'])(
  'preserves previous %s response fallback', charset => {
    const examples = ['0000feff0000d800', 'fffe000041000000', 'ffffffff000102', '0000004100000042', '4100000042000000'];
    for (const hex of examples) {
      const bytes = Buffer.from(hex, 'hex');
      const expected = iconv.decode(bytes, charset, {stripBOM:false});
      const spy = jest.spyOn(iconv, 'decode').mockImplementation(() => { throw new Error('unexpected iconv'); });
      try { expect(decodeSourceCharset(bytes, charset)).toBe(expected); } finally { spy.mockRestore(); }
    }
  },
);

test.each(['UTF-32', 'UCS-4', 'UTF-32LE', 'UTF-32BE', 'UCS-4LE', 'UCS-4BE'])(
  'matches %s on random short TXT data', charset => {
    let seed = 0x12345678;
    for (let iteration = 0; iteration < 3000; iteration++) {
      const bytes = Buffer.alloc(iteration % 25);
      for (let i = 0; i < bytes.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; bytes[i] = seed >>> 24; }
      expect(decodeTxtBase64(bytes.toString('base64'), charset)).toBe(iconv.decode(bytes, charset).replace(/^\ufeff/, ''));
    }
  },
);
