import mappingData from '../data/sourceCharsetDecodeData.json';
import overrides from '../data/sourceGbkEncodeOverrides.json';

// Build the inverse from the existing ICU decoding data only when GBK is used.
// Entries are stored one higher than their packed bytes so zero means absent.
const inverse: Partial<Record<'GBK' | 'CP936', Uint32Array>> = {};
function gbkInverse(charset: 'GBK' | 'CP936'): Uint32Array {
  if (inverse[charset]) return inverse[charset];
  const result = new Uint32Array(0x10000);
  const table = mappingData.multi.GBK;
  const rows = table.double as Record<string, string>;
  const add = (code: number, bytes: number) => {
    if (code !== 0xfffd && !result[code]) result[code] = bytes + 1;
  };
  for (let byte = 0; byte < 256; byte++) {
    if (rows[byte] === undefined) add(table.single.charCodeAt(byte), byte);
  }
  for (const [lead, row] of Object.entries(rows)) {
    for (let trail = 0; trail < 256; trail++) {
      const code = row.charCodeAt(trail);
      if (code > 2) add(code, Number(lead) * 256 + trail);
    }
  }
  for (const [code, bytes] of overrides[charset]) result[code] = bytes + 1;
  inverse[charset] = result;
  return result;
}

/** GBK request encoding, including Java's single replacement for a scalar. */
export function encodeSourceGbk(value: string, charset: 'GBK' | 'CP936'): number[] {
  const mapping = gbkInverse(charset), bytes: number[] = [];
  const parts = value.split('€');
  for (let partIndex = 0; partIndex < parts.length; partIndex++) {
    if (partIndex) bytes.push(0xa2, 0xe3);
    const part = parts[partIndex], limit = bytes.length + part.length * 3;
    for (let index = 0; index < part.length; index++) {
      const code = part.charCodeAt(index);
      if (code >= 0xd800 && code <= 0xdbff && index + 1 < part.length) {
        const next = part.charCodeAt(index + 1);
        if (next >= 0xdc00 && next <= 0xdfff) index++;
      }
      const packed = mapping[code] ? mapping[code] - 1 : 0x3f;
      if (packed > 0xffffff) bytes.push(packed >>> 24);
      if (packed > 0xffff) bytes.push((packed >>> 16) & 0xff);
      if (packed > 0xff) bytes.push((packed >> 8) & 0xff);
      bytes.push(packed & 0xff);
    }
    // Match the previous encoder's three-bytes-per-unit output buffer.
    if (bytes.length > limit) bytes.length = limit;
  }
  return bytes;
}

/** TXT export uses the original GBK euro byte and a single output buffer. */
export function writeTxtGbk(value: string, emit: (...bytes: number[]) => void, charset: 'GBK' | 'CP936' = 'GBK'): void {
  const mapping = gbkInverse(charset), limit = value.length * 3;
  let written = 0;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) index++;
    }
    const packed = code === 0x20ac ? 0x80 : mapping[code] ? mapping[code] - 1 : 0x3f;
    const part: number[] = [];
    if (packed > 0xffffff) part.push(packed >>> 24);
    if (packed > 0xffff) part.push((packed >>> 16) & 0xff);
    if (packed > 0xff) part.push((packed >> 8) & 0xff);
    part.push(packed & 0xff);
    emit(...part.slice(0, Math.max(0, limit - written)));
    written += part.length;
    if (written >= limit) break;
  }
}
