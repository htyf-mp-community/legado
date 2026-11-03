import iconv from 'iconv-lite';
import { decodeTxtBase64 } from '../src/core/txtEncoding';
import { decodeTxtLegacy } from '../src/core/txtLegacyDecode';

jest.mock('react-native-quick-base64', () => ({
  toByteArray: (value: string) => new Uint8Array(Buffer.from(value, 'base64')),
}));

test.each(['GBK', 'GB18030', 'BIG5', 'CP936', 'CP950', 'SHIFT_JIS', 'EUC-JP', 'EUC-KR'])('decodes %s TXT without iconv', charset => {
  const value = '第一章：西游记，中文。';
  const encodedBytes = iconv.encode(value, charset);
  const expected = iconv.decode(encodedBytes, charset);
  const encoded = encodedBytes.toString('base64');
  const decode = jest.spyOn(iconv, 'decode').mockImplementation(() => { throw new Error('unexpected iconv'); });
  try { expect(decodeTxtBase64(encoded, charset)).toBe(expected); }
  finally { decode.mockRestore(); }
});

test.each(['GBK', 'GB18030', 'BIG5', 'CP936', 'CP950', 'SHIFT_JIS', 'EUC-JP', 'EUC-KR'])('matches %s on all one- and two-byte inputs', charset => {
  const differences: string[] = [];
  const check = (bytes: Buffer) => {
    const expected = iconv.decode(bytes, charset).replace(/^\ufeff/, '');
    const actual = decodeTxtBase64(bytes.toString('base64'), charset);
    if (actual !== expected && differences.length < 10) differences.push(bytes.toString('hex'));
  };
  for (let a = 0; a < 256; a++) {
    check(Buffer.from([a]));
    for (let b = 0; b < 256; b++) check(Buffer.from([a,b]));
  }
  expect(differences).toEqual([]);
});

test.each(['GBK', 'GB18030', 'BIG5', 'CP936', 'CP950', 'SHIFT_JIS', 'EUC-JP', 'EUC-KR'])('matches %s on mixed valid and invalid byte sequences', charset => {
  let seed = 0x12345678;
  for (let iteration = 0; iteration < 20000; iteration++) {
    const bytes = Buffer.alloc(iteration % 25);
    for (let index = 0; index < bytes.length; index++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      bytes[index] = seed >>> 24;
    }
    expect(decodeTxtBase64(bytes.toString('base64'), charset)).toBe(iconv.decode(bytes, charset).replace(/^\ufeff/, ''));
  }
});

test('matches EUC-JP on all three-byte sequences beginning with 8F', () => {
  const bytes = Buffer.alloc(3); bytes[0] = 0x8f;
  const differences: string[] = [];
  for (let second = 0; second < 256; second++) {
    bytes[1] = second;
    for (let third = 0; third < 256; third++) {
      bytes[2] = third;
      if (decodeTxtLegacy(bytes, 'EUCJP') !== iconv.decode(bytes, 'EUC-JP') && differences.length < 10) differences.push(bytes.toString('hex'));
    }
  }
  expect(differences).toEqual([]);
});

test('matches every GB18030 four-byte pointer, including out-of-range values', () => {
  const bytes = Buffer.alloc(4), differences: number[] = [];
  for (let pointer = 0; pointer < 126 * 10 * 126 * 10; pointer++) {
    let remaining = pointer;
    bytes[0] = 0x81 + Math.floor(remaining / 12600); remaining %= 12600;
    bytes[1] = 0x30 + Math.floor(remaining / 1260); remaining %= 1260;
    bytes[2] = 0x81 + Math.floor(remaining / 10); bytes[3] = 0x30 + remaining % 10;
    if (decodeTxtLegacy(bytes, 'GB18030') !== iconv.decode(bytes, 'GB18030') && differences.length < 10) differences.push(pointer);
  }
  expect(differences).toEqual([]);
});
