import mappingData from '../data/sourceCharsetDecodeData.json';
import encodingData from '../data/big5EncodeData.json';
import cp950Data from '../data/cp950EncodeData.json';

type Charset = 'BIG5' | 'CP950';
const inverse: Partial<Record<Charset, Uint32Array>> = {};
let supplementary: Map<number, number> | undefined;
function mappings(charset: Charset): { bmp: Uint32Array; extra: Map<number, number> } {
  const existing = inverse[charset];
  if (existing && supplementary) return { bmp: existing, extra: supplementary };
  const bmp = new Uint32Array(0x10000);
  const table = mappingData.multi.Big5, rows = table.double as Record<string, string>;
  const add = (code: number, value: number) => {
    if (code !== 0xfffd && !bmp[code]) bmp[code] = value + 1;
  };
  for (let byte = 0; byte < 256; byte++)
    if (rows[byte] === undefined) add(table.single.charCodeAt(byte), byte);
  for (const [lead, row] of Object.entries(rows)) {
    for (let trail = 0; trail < 256; trail++) {
      const code = row.charCodeAt(trail);
      if (code > 2) add(code, Number(lead) * 256 + trail);
    }
  }
  for (const [code, packed] of charset === 'BIG5' ? encodingData.overrides : cp950Data) bmp[code] = packed + 1;
  inverse[charset] = bmp;
  supplementary ??= new Map(encodingData.supplementary.map(([code, packed]) => [code, packed]));
  return { bmp, extra: supplementary };
}

export function writeBig5(value: string, emit: (...bytes: number[]) => void, charset: Charset = 'BIG5'): void {
  const { bmp, extra } = mappings(charset);
  for (let index = 0; index < value.length; index++) {
    let code = value.charCodeAt(index), packed: number;
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + next - 0xdc00; index++;
      } else code = 0x3f;
    } else if (code >= 0xdc00 && code <= 0xdfff) code = 0x3f;
    const next = value.charCodeAt(index + 1);
    if (charset === 'BIG5' && (code === 0xca || code === 0xea) && (next === 0x304 || next === 0x30c)) {
      packed = code === 0xca ? (next === 0x304 ? 0x8862 : 0x8864) : (next === 0x304 ? 0x88a3 : 0x88a5);
      index++;
    } else packed = code < 0x10000 ? (bmp[code] ? bmp[code] - 1 : 0x3f) : (charset === 'BIG5' ? extra.get(code) ?? 0x3f : 0x3f);
    if (packed > 0xff) emit(packed >> 8, packed & 0xff);
    else emit(packed);
  }
}
