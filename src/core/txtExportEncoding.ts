import type { ExportCharset } from '../data/exportPreferences';
import { writeBig5 } from './big5Encoding';
import { writeSourceGb18030 } from './sourceGb18030Encoding';
import { writeTxtGbk } from './sourceGbkEncoding';

/** Encode book text without allocating a JavaScript number array per book. */
export function encodeTxtExport(value: string, charset: ExportCharset): Uint8Array {
  let bytes = new Uint8Array(Math.min(65536, Math.max(64, value.length))), length = 0;
  const emit = (...part: number[]) => {
    const needed = length + part.length;
    if (needed > bytes.length) {
      const next = new Uint8Array(Math.max(needed, bytes.length * 2));
      next.set(bytes); bytes = next;
    }
    bytes.set(part, length); length = needed;
  };
  if (charset === 'BIG5') writeBig5(value, emit);
  else if (charset === 'GBK') writeTxtGbk(value, emit);
  else if (charset === 'GB18030') writeSourceGb18030(value, emit);
  else if (charset === 'UTF-16LE' || charset === 'UTF-16BE') {
    for (let index = 0; index < value.length; index++) {
      const code = value.charCodeAt(index);
      if (charset === 'UTF-16LE') emit(code & 0xff, code >> 8);
      else emit(code >> 8, code & 0xff);
    }
  } else if (charset === 'UTF-8') {
    for (let index = 0; index < value.length; index++) {
      let code = value.charCodeAt(index);
      if (code >= 0xd800 && code <= 0xdbff) {
        const next = value.charCodeAt(index + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          code = 0x10000 + ((code - 0xd800) << 10) + next - 0xdc00; index++;
        } else code = 0xfffd;
      } else if (code >= 0xdc00 && code <= 0xdfff) code = 0xfffd;
      if (code < 0x80) emit(code);
      else if (code < 0x800) emit(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      else if (code < 0x10000) emit(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      else emit(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  } else throw new Error('UNSUPPORTED_CHARSET');
  return bytes.subarray(0, length);
}
