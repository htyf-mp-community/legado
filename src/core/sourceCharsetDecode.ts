import mappingData from '../data/sourceCharsetDecodeData.json';
import { canEncodeSourceCharset } from './sourceCharsetAvailability';
import { decodeTxtLegacy, legacyTxtCharset } from './txtLegacyDecode';
import { decodeRawUtf16 } from './rawUtf16Decode';
import { decodeSingleByte, supportsSingleByteCharset } from './singleByteCharset';
import { decodeUtf32Compatibility, utf32Order } from './utf32Compatibility';
import {decodeAutoUtf16, decodeRemainingCharset, supportsRemainingCharset} from './remainingCharsets';

type MultiMap = { single: string; double: Record<string, string>; triple: Record<string, string> };
const multiMaps = mappingData.multi as Record<string, MultiMap>;
const singleMaps = mappingData.single as Record<string, string>;

const keyOf = (name: string) => name.toLowerCase().replace(/[-_:]/g, '');
export const canDecodeSourceCharset = (name: string) => /^[A-Za-z0-9][A-Za-z0-9._:+-]*$/.test(name)
  && (canEncodeSourceCharset(name) || ['iso2022jp', 'iso2022kr', 'iso2022cn'].includes(keyOf(name)));

/** UTF-8 replacement decoding, retaining BOM as required by the source parser. */
function utf8(bytes: Uint8Array, javaReplacement = false) {
  const chunks: string[] = [], units: number[] = [];
  const append = (code: number) => {
    if (code <= 0xffff) units.push(code);
    else { const value = code - 0x10000; units.push(0xd800 | (value >> 10), 0xdc00 | (value & 0x3ff)); }
    if (units.length >= 4096) { chunks.push(String.fromCharCode(...units)); units.length = 0; }
  };
  for (let i = 0; i < bytes.length;) {
    const lead = bytes[i];
    if (lead < 0x80) { append(lead); i++; continue; }
    const length = lead >= 0xc2 && lead <= 0xdf ? 2 : lead >= 0xe0 && lead <= 0xef ? 3 : lead >= 0xf0 && lead <= 0xf4 ? 4 : 0;
    if (!length) { append(0xfffd); i++; continue; }
    let code = lead & (0x7f >> length), consumed = 1;
    while (consumed < length && i + consumed < bytes.length) {
      const next = bytes[i + consumed];
      if (next < 0x80 || next > 0xbf ||
          (consumed === 1 && ((lead === 0xe0 && next < 0xa0) || (lead === 0xed && next > 0x9f && !javaReplacement) ||
            (lead === 0xf0 && next < 0x90) || (lead === 0xf4 && next > 0x8f)))) break;
      code = (code << 6) | (next & 0x3f);
      consumed++;
    }
    append(consumed === length && !(javaReplacement && code >= 0xd800 && code <= 0xdfff) ? code : 0xfffd);
    i += consumed;
  }
  if (units.length) chunks.push(String.fromCharCode(...units));
  return chunks.join('');
}

/** Java UTF-8 decoding consumes an encoded surrogate as one malformed sequence. */
export function decodeJavaUtf8(bytes: Uint8Array) {
  return utf8(bytes, true);
}

function utf16(bytes: Uint8Array, little: boolean) {
  let result = '';
  const unit = (i: number) => little ? bytes[i] | (bytes[i + 1] << 8) : (bytes[i] << 8) | bytes[i + 1];
  for (let i = 0; i < bytes.length;) {
    if (i + 1 >= bytes.length) { result += '\ufffd'; break; }
    const first = unit(i); i += 2;
    if (first >= 0xd800 && first <= 0xdbff) {
      if (i + 1 >= bytes.length) { result += '\ufffd'; break; }
      const second = unit(i);
      if (second >= 0xdc00 && second <= 0xdfff) { result += String.fromCharCode(first, second); i += 2; }
      else result += '\ufffd';
    } else result += first >= 0xdc00 && first <= 0xdfff ? '\ufffd' : String.fromCharCode(first);
  }
  return result;
}

function utf32(bytes: Uint8Array, little: boolean) {
  let result = '';
  for (let i = 0; i < bytes.length; i += 4) {
    if (i + 3 >= bytes.length) { result += '\ufffd'; break; }
    const value = little ? ((bytes[i + 3] << 24) | (bytes[i + 2] << 16) | (bytes[i + 1] << 8) | bytes[i]) >>> 0
      : ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0;
    result += value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff) ? '\ufffd' : String.fromCodePoint(value);
  }
  return result;
}

/** Frozen ICU mapping facts; 0/1 mark invalid lengths, 2 marks an incomplete prefix. */
function multiByte(bytes: Uint8Array, name: string) {
  const table = multiMaps[name];
  let result = '';
  for (let i = 0; i < bytes.length;) {
    const first = bytes[i], row = table.double[first];
    if (row === undefined) { result += table.single[first]; i++; continue; }
    if (i + 1 >= bytes.length) { result += '\ufffd'; break; }
    const second = bytes[i + 1], value = row.charCodeAt(second);
    if (value > 2) { result += String.fromCharCode(value); i += 2; continue; }
    if (value < 2) { result += '\ufffd'; i += value + 1; continue; }
    if (name === 'EUC-JP') {
      if (i + 2 >= bytes.length) { result += '\ufffd'; break; }
      const decoded = table.triple[second]?.charCodeAt(bytes[i + 2]) ?? 0;
      result += decoded > 2 ? String.fromCharCode(decoded) : '\ufffd';
      i += decoded > 2 ? 3 : decoded + 1; continue;
    }
    if (name === 'GB18030') {
      if (i + 2 >= bytes.length) { result += '\ufffd'; break; }
      const third = bytes[i + 2];
      if (third < 0x81 || third > 0xfe) { result += '\ufffd'; i++; continue; }
      if (i + 3 >= bytes.length) { result += '\ufffd'; break; }
      const fourth = bytes[i + 3];
      if (fourth < 0x30 || fourth > 0x39) { result += '\ufffd'; i++; continue; }
      const index = (((first - 0x81) * 10 + second - 0x30) * 126 + third - 0x81) * 10 + fourth - 0x30;
      const ranges = mappingData.gb18030Ranges;
      let lo = 0, hi = ranges.length - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >>> 1; if (ranges[mid][0] <= index) lo = mid; else hi = mid - 1; }
      const [start, code] = ranges[lo];
      result += code < 0 ? '\ufffd' : String.fromCodePoint(code + index - start); i += 4; continue;
    }
    result += '\ufffd'; i++;
  }
  return result;
}

const escapeStates = new Map(mappingData.escapes.map(row => [row.bytes.join(','), row]));
const isoGraphic = (b: number) => b >= 0x21 && b <= 0x7e;
const isoControl = (b: number) => b === 14 || b === 15 || b === 27;

/** ICU default JP/KR/CN designations, single shifts and malformed-byte consumption. */
function iso2022(bytes: Uint8Array, variant: 'jp' | 'kr' | 'cn') {
  let result = '', mode = 'ASCII', group = 0, previousGroup = 0, empty = false;
  let g1: 0 | 1 | undefined, g2 = false;
  for (let i = 0; i < bytes.length;) {
    const b = bytes[i++];
    if (b === 27) {
      let key = '27', end = i, state = escapeStates.get(key);
      while (state && !state.terminal && end < bytes.length) { key += `,${bytes[end++]}`; state = escapeStates.get(key); }
      if (!state) { result += '\ufffd'; empty = false; continue; }
      if (!state.terminal) { result += '\ufffd'; break; }
      const target = variant === 'jp' ? state.jp : state.cn;
      let allowed = false, illegal = false;
      if (variant === 'kr') allowed = state.kr;
      else if (variant === 'jp') {
        allowed = ['ASCII', 'JISX201', 'JISX208', 'HWKANA_7BIT'].includes(target);
        if (allowed) mode = target;
        else if (target === 'SS2_STATE') illegal = true;
      } else if (target === 'GB2312_1' || target === 'CNS_11643_1') { g1 = target === 'GB2312_1' ? 0 : 1; allowed = true; }
      else if (target === 'CNS_11643_2') { g2 = true; allowed = true; }
      else if (target === 'SS2_STATE') {
        if (g2) { if (group < 2) previousGroup = group; group = 2; allowed = true; }
        else illegal = true;
      } else if (target === 'SS3_STATE') illegal = true;
      if (!illegal) i = end;
      if (!allowed || (variant !== 'kr' && empty)) { result += '\ufffd'; empty = false; }
      else if (variant === 'jp') empty = true;
      else if (variant === 'kr') empty = false;
      continue;
    }
    if (b === 14 || b === 15) {
      if (variant === 'jp') { result += '\ufffd'; empty = false; continue; }
      if (b === 15) { group = 0; if (empty) { result += '\ufffd'; empty = false; } }
      else if (variant === 'kr' || g1 !== undefined) { group = 1; empty = true; }
      else { result += '\ufffd'; empty = false; }
      continue;
    }
    if (b === 10 || b === 13) {
      if (variant === 'jp' && mode !== 'ASCII' && mode !== 'JISX201') mode = 'ASCII';
      if (variant === 'cn') { group = 0; g1 = undefined; g2 = false; }
    }
    empty = false;
    const double = variant === 'jp' ? mode === 'JISX208' : group !== 0;
    if (double) {
      if (i >= bytes.length) { result += '\ufffd'; break; }
      const second = bytes[i], valid = isoGraphic(b) && isoGraphic(second);
      if (valid) {
        i++;
        const offset = (b - 0x21) * 94 + second - 0x21;
        if (variant === 'kr') result += multiByte(new Uint8Array([b | 0x80, second | 0x80]), 'ibm-949');
        else {
          const code = variant === 'jp' ? mappingData.jis[offset] : mappingData.cns[group === 2 ? '2' : g1 === 1 ? '1' : '0'][offset];
          result += code < 0 ? '\ufffd' : String.fromCodePoint(code);
        }
      } else { if (!isoGraphic(second) && !isoControl(second)) i++; result += '\ufffd'; }
      if (group >= 2) group = previousGroup;
    } else if (variant === 'jp' && mode === 'HWKANA_7BIT') result += b >= 0x21 && b <= 0x5f ? String.fromCharCode(0xff61 + b - 0x21) : '\ufffd';
    else if (b > 0x7f) result += '\ufffd';
    else if (variant === 'kr') result += multiMaps['ibm-949'].single[b];
    else result += mode === 'JISX201' && b === 0x5c ? '\u00a5' : mode === 'JISX201' && b === 0x7e ? '\u203e' : String.fromCharCode(b);
  }
  return result;
}

const canonicalMaps = Object.fromEntries([...Object.keys(multiMaps), ...Object.keys(singleMaps)].map(name => [keyOf(name), name]));

export function decodeSourceCharset(bytes: Uint8Array, name: string) {
  const key = keyOf(name);
  if (key === 'utf8') return utf8(bytes);
  if (key === 'utf16le' || key === 'unicodelittleunmarked') return utf16(bytes, true);
  if (key === 'utf16be' || key === 'unicodebigunmarked') return utf16(bytes, false);
  if (key === 'utf16' || key === 'unicode') {
    const hasBom = bytes.length >= 2 && ((bytes[0] === 0xfe && bytes[1] === 0xff) || (bytes[0] === 0xff && bytes[1] === 0xfe));
    return utf16(hasBom ? bytes.subarray(2) : bytes, hasBom && bytes[0] === 0xff);
  }
  if (key === 'utf32le') return utf32(bytes, true);
  if (key === 'utf32be') return utf32(bytes, false);
  if (key === 'iso2022jp' || key === 'iso2022kr' || key === 'iso2022cn') return iso2022(bytes, key === 'iso2022jp' ? 'jp' : key === 'iso2022kr' ? 'kr' : 'cn');
  const canonical = canonicalMaps[key];
  if (canonical && multiMaps[canonical]) return multiByte(bytes, canonical);
  if (canonical && singleMaps[canonical]) return Array.from(bytes, b => singleMaps[canonical][b]).join('');
  const fallbackKey = name.toLowerCase().replace(/:\d{4}$|[^0-9a-z]/g, '');
  if (fallbackKey === 'utf8' || fallbackKey === 'unicode11utf8') return utf8(bytes);
  if (fallbackKey === 'utf16') return decodeAutoUtf16(bytes);
  if (fallbackKey === 'utf16le' || fallbackKey === 'ucs2' || fallbackKey === 'utf16be')
    return decodeRawUtf16(bytes, fallbackKey !== 'utf16be');
  const utf32Fallback = utf32Order(name);
  if (utf32Fallback) return decodeUtf32Compatibility(bytes, utf32Fallback);
  const legacy = legacyTxtCharset(fallbackKey);
  if (legacy) return decodeTxtLegacy(bytes, legacy);
  if (supportsSingleByteCharset(name)) return decodeSingleByte(bytes, name);
  if (supportsRemainingCharset(name)) return decodeRemainingCharset(bytes, name);
  throw new Error('UNSUPPORTED_CHARSET');
}
