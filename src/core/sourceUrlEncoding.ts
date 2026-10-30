import iconv from 'iconv-lite';

const alphaNumeric = (value: string) => /^[A-Za-z0-9]$/.test(value);
const queryCharacters = new Set('!$%&()*+,-./:;=?@[\\]^_`{|}~');
const formCharacters = new Set('*-._');
const percent = (bytes: number[]) => bytes.map(byte => `%${byte.toString(16).toUpperCase().padStart(2, '0')}`).join('');
const high = (code: number) => code >= 0xd800 && code <= 0xdbff;
const low = (code: number) => code >= 0xdc00 && code <= 0xdfff;

/** Java CharsetEncoder replacement differs from iconv-lite for malformed UTF-16. */
function javaBytes(value: string, charset: string, bom = true): number[] {
  const key = charset.toLowerCase().replace(/[-_]/g, '');
  const utf16 = /^(?:utf16|utf16be|utf16le|ucs2|unicodebig|unicodelittle)$/.test(key);
  let normalized = '';
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (high(code) && low(value.charCodeAt(index + 1))) {
      const pair = value.slice(index, index + 2); index++;
      // A Java legacy encoder substitutes one unmappable Unicode scalar.
      const encoded = iconv.encode(pair, charset);
      normalized += !utf16 && key !== 'utf8' && encoded.length === 2 && encoded.every((byte: number) => byte === 0x3f) ? '?' : pair;
    } else normalized += high(code) || low(code) ? (utf16 ? '\ufffd' : '?') : value[index];
  }
  if (key === 'utf16' || key === 'unicodebig') {
    const bytes = [...iconv.encode(normalized, 'utf16be')];
    return bom && normalized ? [0xfe, 0xff, ...bytes] : bytes;
  }
  // The JDK GBK table uses A2E3 for Euro; iconv-lite's CP936 alias uses 80.
  if (key === 'gbk' || key === 'cp936' || key === 'windows936')
    return normalized.split('€').flatMap((part, index) => [...(index ? [0xa2, 0xe3] : []), ...iconv.encode(part, charset)]);
  return [...iconv.encode(normalized, charset)];
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
