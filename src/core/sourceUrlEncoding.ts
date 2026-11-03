import { encodeSourceGbk, writeTxtGbk } from './sourceGbkEncoding';
import { encodeSourceGb18030 } from './sourceGb18030Encoding';
import { writeBig5 } from './big5Encoding';
import { encodeJavaSingleByte, supportsSingleByteCharset } from './singleByteCharset';
import { legacyTxtCharset } from './txtLegacyDecode';
import { encodeEastAsian } from './eastAsianEncoding';
import { encodeUtf32Source, utf32Order } from './utf32Compatibility';
import {encodeRemainingCharset, supportsRemainingCharset} from './remainingCharsets';

const alphaNumeric = (value: string) => /^[A-Za-z0-9]$/.test(value);
const queryCharacters = new Set('!$%&()*+,-./:;=?@[\\]^_`{|}~');
const formCharacters = new Set('*-._');
const percent = (bytes: number[]) => bytes.map(byte => `%${byte.toString(16).toUpperCase().padStart(2, '0')}`).join('');
const high = (code: number) => code >= 0xd800 && code <= 0xdbff;
const low = (code: number) => code >= 0xdc00 && code <= 0xdfff;

/** Java UTF-8 encoder replaces each unpaired UTF-16 surrogate with '?'. */
export function utf8Bytes(value: string): number[] {
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index++) {
    let code = value.charCodeAt(index);
    if (high(code) && low(value.charCodeAt(index + 1))) {
      code = 0x10000 + ((code - 0xd800) << 10) + value.charCodeAt(++index) - 0xdc00;
    } else if (high(code) || low(code)) code = 0x3f;
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
  }
  return bytes;
}

function utf16Bytes(value: string, little: boolean, bom: boolean): number[] {
  const bytes: number[] = bom && value ? [0xfe, 0xff] : [];
  const push = (code: number) => {
    if (little) bytes.push(code & 0xff, code >> 8);
    else bytes.push(code >> 8, code & 0xff);
  };
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (high(code) && low(value.charCodeAt(index + 1))) {
      push(code); push(value.charCodeAt(++index));
    } else push(high(code) || low(code) ? 0xfffd : code);
  }
  return bytes;
}

/** Java CharsetEncoder replacement differs from iconv-lite for malformed UTF-16. */
export function javaBytes(value: string, charset: string, bom = true): number[] {
  const key = charset.toLowerCase().replace(/[-_]/g, '');
  const canonical = charset.toLowerCase().replace(/:\d{4}$|[^0-9a-z]/g, '');
  if (canonical === 'utf8' || canonical === 'unicode11utf8') return utf8Bytes(value);
  if (key === 'gb18030') return encodeSourceGb18030(value);
  if (key === 'big5' || key === 'big5hkscs' || key === 'cnbig5') {
    const bytes: number[] = [];
    writeBig5(value, (...part) => { bytes.push(...part); });
    return bytes;
  }
  if (key === 'gbk' || key === 'cp936' || key === 'windows936')
    return encodeSourceGbk(value, key === 'gbk' ? 'GBK' : 'CP936');
  if (key === 'utf16' || key === 'utf16be' || key === 'utf16le' || key === 'ucs2')
    return utf16Bytes(value, key === 'utf16le' || key === 'ucs2', key === 'utf16' && bom);
  if (canonical === 'utf16' || canonical === 'utf16be' || canonical === 'utf16le' || canonical === 'ucs2') {
    const normalized = value.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g, part => part.length === 2 ? part : '?');
    const encoded = utf16Bytes(normalized, canonical !== 'utf16be', false);
    return canonical === 'utf16' ? [0xff, 0xfe, ...encoded] : encoded;
  }
  const utf32 = utf32Order(charset);
  if (utf32) return encodeUtf32Source(value, utf32);
  if (supportsSingleByteCharset(charset)) return encodeJavaSingleByte(value, charset);
  const eastAsian = legacyTxtCharset(charset.toLowerCase().replace(/:\d{4}$|[^0-9a-z]/g, ''));
  if (eastAsian === 'SHIFTJIS' || eastAsian === 'EUCJP' || eastAsian === 'CP949') return encodeEastAsian(value, eastAsian);
  if (eastAsian === 'GB18030') return encodeSourceGb18030(value);
  if (eastAsian === 'GBK' || eastAsian === 'CP936' || eastAsian === 'BIG5' || eastAsian === 'CP950') {
    const bytes: number[] = [];
    if (eastAsian === 'GBK' || eastAsian === 'CP936') writeTxtGbk(value, (...part) => { bytes.push(...part); }, eastAsian);
    else writeBig5(value, (...part) => { bytes.push(...part); }, eastAsian);
    return bytes;
  }
  if (supportsRemainingCharset(charset)) {
    let normalized = '';
    for (let index = 0; index < value.length; index++) {
      const code = value.charCodeAt(index);
      if (high(code) && low(value.charCodeAt(index + 1))) {
        const pair = value.slice(index, index + 2); index++;
        const encoded = encodeRemainingCharset(pair, charset);
        normalized += encoded.length === 2 && encoded.every(byte => byte === 0x3f) ? '?' : pair;
      } else normalized += high(code) || low(code) ? '?' : value[index];
    }
    return encodeRemainingCharset(normalized, charset);
  }
  throw new Error('UNSUPPORTED_CHARSET');
}

function escapeNative(value: string) {
  return value.split('').map(char => {
    if (alphaNumeric(char)) return char;
    const code = char.charCodeAt(0);
    return (code < 16 ? '%0' : code < 256 ? '%' : '%u') + code.toString(16);
  }).join('');
}

function formValue(value: string, charset: string) {
  if (!charset && /^(?:[A-Za-z0-9*._-]|%[0-9A-Fa-f]{2})*$/.test(value)) return value;
  if (charset === 'escape') return escapeNative(value);
  let result = '', group = '';
  const flush = () => { if (group) { result += percent(javaBytes(group, charset || 'UTF-8')); group = ''; } };
  for (const char of value) {
    if (alphaNumeric(char) || formCharacters.has(char) || char === ' ') {
      flush(); result += char === ' ' ? '+' : char;
    } else group += char;
  }
  flush(); return result;
}

/** java.net.URLEncoder encodes the entire value, including existing escapes. */
export function encodeJavaFormValue(value: string, charset = 'UTF-8'): string {
  return formValue(value, charset);
}

/** AnalyzeUrl.encodeParams: RFC3986 query codec vs Java form/legacy escape. */
export function encodeSourceParams(value: string, charset = '', isQuery = true): string {
  if (isQuery && charset !== 'escape') {
    let result = '', pending = '', wrote = false;
    const append = (chars: string) => {
      const bytes = javaBytes(chars, charset || 'UTF-8', !wrote);
      if (bytes.length) wrote = true;
      result += percent(bytes);
    };
    for (let index = 0; index < value.length; index++) {
      const char = value[index], code = value.charCodeAt(index);
      if (alphaNumeric(char) || queryCharacters.has(char)) { result += char; continue; }
      // Hutool's writer receives only unsafe UTF-16 units. Its pending high
      // surrogate survives safe characters and is not flushed at end-of-input.
      if (pending) {
        if (low(code)) { append(pending + char); pending = ''; continue; }
        append(pending); pending = '';
      }
      if (high(code)) {
        if (!wrote && /^(?:utf16|unicodebig)$/.test(charset.toLowerCase().replace(/[-_]/g, ''))) {
          result += '%FE%FF'; wrote = true;
        }
        pending = char;
      }
      else append(char);
    }
    return result;
  }
  let result = '';
  for (const field of value.split('&')) {
    const separator = field.indexOf('=');
    if (result) result += '&';
    result += separator < 0 ? formValue(field, charset)
      : `${formValue(field.slice(0, separator), charset)}=${formValue(field.slice(separator + 1), charset)}`;
  }
  return result;
}
