import data from '../data/singleByteCharsetData.json';

const names = data.names as Record<string, number>;
const inverse = new Map<number, Uint16Array>();

function tableIndex(name: string): number | undefined {
  const key = name.toLowerCase().replace(/:\d{4}$|[^0-9a-z]/g, '');
  return Object.prototype.hasOwnProperty.call(names, key) ? names[key] : undefined;
}

export function supportsSingleByteCharset(name: string): boolean {
  return tableIndex(name) !== undefined;
}

export function decodeSingleByte(bytes: Uint8Array, name: string): string {
  const index = tableIndex(name);
  if (index === undefined) throw new Error('UNSUPPORTED_CHARSET');
  const table = data.tables[index], chunks: string[] = [];
  let text = '';
  for (const byte of bytes) {
    text += table[byte];
    if (text.length >= 8192) { chunks.push(text); text = ''; }
  }
  if (text) chunks.push(text);
  return chunks.join('');
}

/** Java URL form semantics replace a supplementary scalar with one '?'. */
export function encodeJavaSingleByte(value: string, name: string): number[] {
  const index = tableIndex(name);
  if (index === undefined) throw new Error('UNSUPPORTED_CHARSET');
  let table = inverse.get(index);
  if (!table) {
    table = new Uint16Array(0x10000);
    const characters = data.tables[index];
    for (let byte = 0; byte < 256; byte++) table[characters.charCodeAt(byte)] = byte + 1;
    inverse.set(index, table);
  }
  const bytes: number[] = [];
  for (let offset = 0; offset < value.length; offset++) {
    let code = value.charCodeAt(offset);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(offset + 1);
      if (next >= 0xdc00 && next <= 0xdfff) offset++;
      code = 0x3f;
    } else if (code >= 0xdc00 && code <= 0xdfff) code = 0x3f;
    bytes.push(table[code] ? table[code] - 1 : 0x3f);
  }
  return bytes;
}
