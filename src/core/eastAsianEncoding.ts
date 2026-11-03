import mappingData from '../data/sourceCharsetDecodeData.json';
import encodingData from '../data/eastAsianEncodeData.json';

type Charset = 'SHIFTJIS' | 'EUCJP' | 'CP949';
type MultiMap = {single: string; double: Record<string, string>; triple: Record<string, string>};
const inverse: Partial<Record<Charset, Uint32Array>> = {};

function mappings(charset: Charset): Uint32Array {
  if (inverse[charset]) return inverse[charset];
  const tables = mappingData.multi as Record<string, MultiMap>;
  const table = tables[charset === 'SHIFTJIS' ? 'Shift_JIS' : charset === 'EUCJP' ? 'EUC-JP' : 'ibm-949'];
  const result = new Uint32Array(0x10000);
  const add = (code: number, bytes: number) => {
    if (code !== 0xfffd && !result[code]) result[code] = bytes + 1;
  };
  for (let byte = 0; byte < 256; byte++)
    if (table.double[byte] === undefined) add(table.single.charCodeAt(byte), byte);
  for (const [lead, row] of Object.entries(table.double)) {
    for (let trail = 0; trail < 256; trail++) {
      const code = row.charCodeAt(trail);
      if (code > 2) add(code, Number(lead) * 256 + trail);
    }
  }
  if (charset === 'EUCJP') {
    for (const [middle, row] of Object.entries(table.triple)) {
      for (let trail = 0; trail < 256; trail++) {
        const code = row.charCodeAt(trail);
        if (code > 2) add(code, 0x8f0000 + Number(middle) * 256 + trail);
      }
    }
  }
  for (const [code, packed] of encodingData[charset]) result[code] = packed + 1;
  inverse[charset] = result;
  return result;
}

export function encodeEastAsian(value: string, charset: Charset): number[] {
  const table = mappings(charset), bytes: number[] = [];
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) index++;
    }
    const packed = table[code] ? table[code] - 1 : 0x3f;
    if (packed > 0xffff) bytes.push(packed >> 16);
    if (packed > 0xff) bytes.push((packed >> 8) & 0xff);
    bytes.push(packed & 0xff);
  }
  return bytes;
}
