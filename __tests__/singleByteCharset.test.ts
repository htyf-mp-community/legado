import iconv from 'iconv-lite';
import { decodeSingleByte, encodeJavaSingleByte, supportsSingleByteCharset } from '../src/core/singleByteCharset';
import { decodeSourceCharset } from '../src/core/sourceCharsetDecode';
import { encodeJavaFormValue } from '../src/core/sourceUrlEncoding';
import { decodeTxtBase64 } from '../src/core/txtEncoding';

jest.mock('react-native-quick-base64', () => ({toByteArray: (value: string) => new Uint8Array(Buffer.from(value, 'base64'))}));

test('recognizes all previously available single-byte names and aliases', () => {
  iconv.encodingExists('utf8');
  const library = iconv as unknown as {encodings: Record<string, unknown>; getCodec(name: string): {constructor: {name: string}}};
  const names = Object.keys(library.encodings).filter(name => iconv.encodingExists(name));
  const wrong = names.filter(name => supportsSingleByteCharset(name) !== (library.getCodec(name).constructor.name === 'SBCSCodec'));
  expect(wrong).toEqual([]);
  expect(supportsSingleByteCharset('not-a-charset')).toBe(false);
});

test('matches all byte decodings and BMP encodings of every single-byte table', () => {
  iconv.encodingExists('utf8');
  const library = iconv as unknown as {encodings: Record<string, unknown>; getCodec(name: string): {constructor: {name: string}; decodeBuf: Buffer}};
  const seen = new Set<string>(), bytes = Uint8Array.from({length:256}, (_, i) => i);
  let text = '';
  for (let code = 0; code <= 0xffff; code++) text += String.fromCharCode(code);
  const normalized = text.replace(/[\ud800-\udbff][\udc00-\udfff]|[\ud800-\udfff]/g, '?');
  const differences: string[] = [];
  for (const name of Object.keys(library.encodings)) {
    if (!iconv.encodingExists(name)) continue;
    const codec = library.getCodec(name);
    if (codec.constructor.name !== 'SBCSCodec') continue;
    const signature = codec.decodeBuf.toString('base64');
    if (seen.has(signature)) continue;
    seen.add(signature);
    if (decodeSingleByte(bytes, name) !== iconv.decode(bytes, name, {stripBOM:false}) ||
        Buffer.from(encodeJavaSingleByte(text, name)).compare(iconv.encode(normalized, name)) !== 0) differences.push(name);
  }
  expect(seen.size).toBe(80);
  expect(differences).toEqual([]);
});

test('uses local single-byte data for source rules, response aliases and TXT', () => {
  const decode = jest.spyOn(iconv, 'decode').mockImplementation(() => { throw new Error('unexpected iconv'); });
  const encode = jest.spyOn(iconv, 'encode').mockImplementation(() => { throw new Error('unexpected iconv'); });
  try {
    expect(encodeJavaFormValue('€😀', 'windows-1252')).toBe('%80%3F');
    expect(decodeSourceCharset(Uint8Array.of(0x80, 0xe9), 'windows-1252:1987')).toBe('€é');
    expect(decodeTxtBase64('gOk=', 'windows-1252')).toBe('€é');
  } finally { decode.mockRestore(); encode.mockRestore(); }
});
