import {decodeJavaUtf8} from './sourceCharsetDecode';
import {utf8Bytes} from './sourceUrlEncoding';

// Character.digit(c, 16) in the JDK used for the native reference, including
// BMP decimal digits and full-width Latin A-F. Supplementary digits are not
// accepted by Hutool's char-at-a-time decoder.
const decimalStarts = [
  0x30,0x660,0x6f0,0x7c0,0x966,0x9e6,0xa66,0xae6,0xb66,0xbe6,
  0xc66,0xce6,0xd66,0xde6,0xe50,0xed0,0xf20,0x1040,0x1090,0x17e0,
  0x1810,0x1946,0x19d0,0x1a80,0x1a90,0x1b50,0x1bb0,0x1c40,0x1c50,
  0xa620,0xa8d0,0xa900,0xa9d0,0xa9f0,0xaa50,0xabf0,0xff10,
];
function digit(char: string) {
  const code = char.charCodeAt(0);
  for (const start of decimalStarts) if (code >= start && code < start + 10) return code - start;
  for (const start of [0x41,0x61,0xff21,0xff41]) if (code >= start && code < start + 6) return code - start + 10;
  throw new Error('无效的十六进制字符');
}

/** Hutool 5.8.22 ignores blank characters and prefixes odd digit counts with 0. */
export function decodeSourceHex(value: string) {
  let input = value.replace(/[\s\u0000\u001c-\u001f\u180e\u202a\u2800\u3164]/g, '');
  if (input.length % 2) input = `0${input}`;
  const bytes = new Uint8Array(input.length / 2);
  for (let index = 0; index < bytes.length; index++) bytes[index] = (digit(input[index * 2]) << 4) | digit(input[index * 2 + 1]);
  return decodeJavaUtf8(bytes);
}

export function encodeSourceHex(value: string) {
  let bytes = 0;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index), next = value.charCodeAt(index + 1);
    if (code >= 0xd800 && code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) { bytes += 4; index++; }
    else if (code >= 0xd800 && code <= 0xdfff) bytes++;
    else bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : 3;
    if (bytes > 500_000) throw new RangeError('JavaScript 十六进制结果超过限制');
  }
  return utf8Bytes(value).map(byte => byte.toString(16).padStart(2, '0')).join('');
}
