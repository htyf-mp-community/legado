import data from '../data/txtLegacyDecodeData.json';

type Charset = 'GBK' | 'GB18030' | 'BIG5' | 'CP936' | 'CP950' | 'SHIFTJIS' | 'EUCJP' | 'CP949';
type DecodeTable = { single: Array<string | null>; pairs: Record<string, Array<string | null>>; triples: Record<string, Array<string | null>> };
const pointerExceptions = new Map<number, string>(data.gb18030Exceptions.map(([pointer, value]) => [Number(pointer), String(value)]));

/** Resolve iconv's canonical names only after existing ICU mappings are tried. */
export function legacyTxtCharset(key: string): Charset | undefined {
  if (['gbk', 'xgbk', 'isoir58'].includes(key)) return 'GBK';
  if (['gb18030', 'chinese'].includes(key)) return 'GB18030';
  if (['big5', 'big5hkscs', 'cnbig5', 'csbig5', 'xxbig5'].includes(key)) return 'BIG5';
  if (['936', 'gb2312', 'gb231280', 'gb23121980', 'csgb2312', 'csiso58gb231280', 'euccn', 'windows936', 'ms936', 'cp936'].includes(key)) return 'CP936';
  if (['950', 'windows950', 'ms950', 'cp950'].includes(key)) return 'CP950';
  if (['932', 'shiftjis', 'csshiftjis', 'mskanji', 'sjis', 'windows31j', 'ms31j', 'xsjis', 'windows932', 'ms932', 'cp932'].includes(key)) return 'SHIFTJIS';
  if (key === 'eucjp') return 'EUCJP';
  if (['949', 'windows949', 'ms949', 'cp949', 'cseuckr', 'csksc56011987', 'euckr', 'isoir149', 'korean', 'ksc56011987', 'ksc56011989', 'ksc5601'].includes(key)) return 'CP949';
  return undefined;
}

function gb18030Pointer(pointer: number): string {
  const exception = pointerExceptions.get(pointer);
  if (exception !== undefined) return exception;
  const ranges = data.gb18030Ranges;
  let low = 0, high = ranges.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >>> 1;
    if (ranges[middle][0] <= pointer) low = middle;
    else high = middle - 1;
  }
  let code = ranges[low][1] + pointer - ranges[low][0];
  if (code < 0x10000) return String.fromCharCode(code);
  code -= 0x10000;
  return String.fromCharCode(0xd800 | (code >> 10), 0xdc00 | (code & 0x3ff));
}

/** Match the previous TXT decoder's byte consumption and replacement rules. */
export function decodeTxtLegacy(bytes: Uint8Array, charset: Charset): string {
  const table = data[charset] as DecodeTable;
  const chunks: string[] = [];
  let result = '';
  const append = (value: string) => {
    result += value;
    if (result.length >= 8192) { chunks.push(result); result = ''; }
  };
  for (let index = 0; index < bytes.length;) {
    const first = bytes[index], single = table.single[first];
    if (single !== null) { append(single); index++; continue; }
    const second = bytes[index + 1], third = bytes[index + 2], fourth = bytes[index + 3];
    if (charset === 'GB18030' && second >= 0x30 && second <= 0x39 &&
        third >= 0x81 && third <= 0xfe && fourth >= 0x30 && fourth <= 0x39) {
      const pointer = (((first - 0x81) * 10 + second - 0x30) * 126 + third - 0x81) * 10 + fourth - 0x30;
      append(gb18030Pointer(pointer)); index += 4; continue;
    }
    const triple = table.triples?.[`${first},${second}`]?.[third];
    if (triple != null) { append(triple); index += 3; continue; }
    const pair = table.pairs[first]?.[second];
    if (pair != null) { append(pair); index += 2; }
    else { append('\ufffd'); index++; }
  }
  if (result) chunks.push(result);
  return chunks.join('');
}
