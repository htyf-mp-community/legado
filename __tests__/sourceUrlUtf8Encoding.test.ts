import iconv from 'iconv-lite';
import { encodeJavaFormValue, encodeSourceParams } from '../src/core/sourceUrlEncoding';

test('encodes UTF-8 source requests and Java form values without iconv', () => {
  const encode = jest.spyOn(iconv, 'encode').mockImplementation(() => { throw new Error('unexpected iconv'); });
  try {
    expect(encodeJavaFormValue('西游记 A+B😀\ud800x\udc00', 'UTF-8'))
      .toBe('%E8%A5%BF%E6%B8%B8%E8%AE%B0+A%2BB%F0%9F%98%80%3Fx%3F');
    expect(encodeSourceParams('q=西游记 😀', 'utf8'))
      .toBe('q=%E8%A5%BF%E6%B8%B8%E8%AE%B0%20%F0%9F%98%80');
  } finally { encode.mockRestore(); }
});

test('matches form encoding for every UTF-16 code unit and boundary pairs', () => {
  const encodeReference = (input: string) => {
    const normalized = input.replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, '?');
    return new URLSearchParams([['v', normalized]]).toString().slice(2);
  };
  const differences: number[] = [];
  for (let unit = 0; unit <= 0xffff; unit++) {
    const input = String.fromCharCode(unit);
    if (encodeJavaFormValue(input) !== encodeReference(input)) differences.push(unit);
  }
  expect(differences).toEqual([]);
  for (const input of ['\ud800\udc00', '\udbff\udfff', '\ud800x\udc00', '\ud800\ud800\udc00', 'a😀z'])
    expect(encodeJavaFormValue(input)).toBe(encodeReference(input));
});

test('encodes UTF-16 source URL values without iconv and keeps Java BOM behavior', () => {
  const encode = jest.spyOn(iconv, 'encode').mockImplementation(() => { throw new Error('unexpected iconv'); });
  try {
    expect(encodeJavaFormValue('中😀\ud800', 'UTF-16BE')).toBe('%4E%2D%D8%3D%DE%00%FF%FD');
    expect(encodeJavaFormValue('中😀\ud800', 'UTF-16LE')).toBe('%2D%4E%3D%D8%00%DE%FD%FF');
    expect(encodeJavaFormValue('中', 'UTF-16')).toBe('%FE%FF%4E%2D');
    expect(encodeJavaFormValue('中', 'UCS-2')).toBe('%2D%4E');
  } finally { encode.mockRestore(); }
});
