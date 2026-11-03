import mappingData from '../data/sourceCharsetDecodeData.json';
import encodingData from '../data/sourceGb18030EncodeData.json';

let inverse: Uint32Array | undefined;
function shortMappings(): Uint32Array {
  if (inverse) return inverse;
  const result = new Uint32Array(0x10000);
  const table = mappingData.multi.GB18030, rows = table.double as Record<string, string>;
  const add = (code: number, value: number) => {
    if (code !== 0xfffd && !result[code]) result[code] = value + 1;
  };
  for (let byte = 0; byte < 256; byte++)
    if (rows[byte] === undefined) add(table.single.charCodeAt(byte), byte);
  for (const [lead, row] of Object.entries(rows)) {
    for (let trail = 0; trail < 256; trail++) {
      const code = row.charCodeAt(trail);
      if (code > 2) add(code, Number(lead) * 256 + trail);
    }
  }
  for (const [code, value] of encodingData.overrides) result[code] = value < 0 ? 0 : value + 1;
  inverse = result;
  return result;
}

function fourBytePointer(code: number): number | undefined {
  const ranges = encodingData.ranges;
  let low = 0, high = ranges.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1, [start, end, pointer] = ranges[middle];
    if (code < start) high = middle - 1;
    else if (code > end) low = middle + 1;
    else return pointer + code - start;
  }
  return undefined;
}

/** Encode GB18030 with the former encoder's malformed-surrogate replacement. */
export function writeSourceGb18030(value: string, emit: (...bytes: number[]) => void): void {
  const mappings = shortMappings();
  for (let index = 0; index < value.length; index++) {
    let code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + next - 0xdc00; index++;
      } else code = 0x3f;
    } else if (code >= 0xdc00 && code <= 0xdfff) code = 0x3f;
    const short = code < 0x10000 ? mappings[code] : 0;
    if (short) {
      const packed = short - 1;
      if (packed > 0xff) emit(packed >> 8, packed & 0xff);
      else emit(packed);
    } else {
      let pointer = fourBytePointer(code);
      if (pointer === undefined) emit(0x3f);
      else {
        const first = 0x81 + Math.floor(pointer / 12600); pointer %= 12600;
        const second = 0x30 + Math.floor(pointer / 1260); pointer %= 1260;
        emit(first, second, 0x81 + Math.floor(pointer / 10), 0x30 + pointer % 10);
      }
    }
  }
}

export function encodeSourceGb18030(value: string): number[] {
  const bytes: number[] = [];
  writeSourceGb18030(value, (...part) => { bytes.push(...part); });
  return bytes;
}
