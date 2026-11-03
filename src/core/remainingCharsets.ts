import {decodeRawUtf16} from './rawUtf16Decode';

const nameKey = (name: string) => name.toLowerCase().replace(/:\d{4}$|[^0-9a-z]/g, '');
const names = new Set(['base64','binary','cesu8','hex','utf7','unicode11utf7','utf7imap']);
export const supportsRemainingCharset = (name: string) => names.has(nameKey(name));

function fromBase64(value: string): number[] {
  const result: number[] = [];
  let buffer = 0, bits = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i) & 255;
    if (code === 61) break;
    const n = code >= 65 && code <= 90 ? code - 65 : code >= 97 && code <= 122 ? code - 71 : code >= 48 && code <= 57 ? code + 4 : code === 43 || code === 45 ? 62 : code === 47 || code === 95 ? 63 : -1;
    if (n < 0) continue;
    buffer = (buffer << 6) | n; bits += 6;
    if (bits >= 8) { bits -= 8; result.push((buffer >> bits) & 255); }
  }
  return result;
}
function toBase64(bytes: number[] | Uint8Array) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const chunks: string[] = [];
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const count = bytes.length - i, value = (bytes[i] << 16) | ((bytes[i+1] ?? 0) << 8) | (bytes[i+2] ?? 0);
    result += alphabet[(value >> 18) & 63] + alphabet[(value >> 12) & 63] + (count > 1 ? alphabet[(value >> 6) & 63] : '=') + (count > 2 ? alphabet[value & 63] : '=');
    if (result.length >= 8192) {chunks.push(result);result='';}
  }
  if (result) chunks.push(result);
  return chunks.join('');
}
const rawString = (bytes: Uint8Array, mask = 255) => {
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 4096)
    chunks.push(String.fromCharCode(...Array.from(bytes.subarray(i, i + 4096), byte => byte & mask)));
  return chunks.join('');
};
const asciiString = (bytes: Uint8Array) => {
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 4096)
    chunks.push(String.fromCharCode(...Array.from(bytes.subarray(i, i + 4096), byte => byte < 128 ? byte : 0xfffd)));
  return chunks.join('');
};
function utf16be(value: string): number[] {
  const result: number[] = [];
  for (let i = 0; i < value.length; i++) { const code = value.charCodeAt(i); result.push(code >> 8, code & 255); }
  return result;
}
function encodeUtf7(value: string, imap: boolean): number[] {
  let result = '', pending = '';
  const flush = () => {
    if (!pending) return;
    if (!imap && pending === '+') result += '+-';
    else result += (imap ? '&' : '+') + toBase64(utf16be(pending)).replace(/=+$/, '').replace(/\//g, imap ? ',' : '/') + '-';
    pending = '';
  };
  for (let i = 0; i < value.length; i++) {
    const char = value[i], code = value.charCodeAt(i);
    if (imap && code >= 0x20 && code <= 0x7e) { flush(); result += char === '&' ? '&-' : char; }
    else if (!imap && /^[A-Za-z0-9'(),.\-/:? \n\r\t]$/.test(char)) { flush(); result += char; }
    else pending += char;
  }
  flush();
  return Array.from(result, char => char.charCodeAt(0));
}
function decodeUtf7(bytes: Uint8Array, imap: boolean): string {
  const marker = imap ? 38 : 43;
  let result = '', index = 0, direct = 0;
  while (index < bytes.length) {
    if (bytes[index] !== marker) { index++; continue; }
    result += asciiString(bytes.subarray(direct,index));
    const start = ++index;
    while (index < bytes.length) {
      const b = bytes[index];
      if ((b >= 65 && b <= 90) || (b >= 97 && b <= 122) || (b >= 48 && b <= 57) || b === 43 || b === 47 || (imap && b === 44)) index++;
      else break;
    }
    if (index === start && bytes[index] === 45) result += String.fromCharCode(marker);
    else {
      const text = asciiString(bytes.subarray(start,index)).replace(/,/g,'/');
      result += decodeRawUtf16(Uint8Array.from(fromBase64(text)),false);
    }
    if (bytes[index] === 45) index++;
    direct = index;
  }
  return result + asciiString(bytes.subarray(direct));
}
function decodeCesu8(bytes: Uint8Array): string {
  let result = '', value = 0, remaining = 0, width = 0;
  for (const byte of bytes) {
    if ((byte & 0xc0) !== 0x80) {
      if (remaining) { result += '\ufffd'; remaining = 0; }
      if (byte < 0x80) result += String.fromCharCode(byte);
      else if (byte < 0xe0) {value = byte & 0x1f; remaining = 1; width = 1;}
      else if (byte < 0xf0) {value = byte & 0x0f; remaining = 2; width = 1;}
      else result += '\ufffd';
    } else if (remaining) {
      value = (value << 6) | (byte & 63); remaining--; width++;
      if (!remaining) result += (width === 2 && value < 0x80 && value > 0) || (width === 3 && value < 0x800) ? '\ufffd' : String.fromCharCode(value);
    } else result += '\ufffd';
  }
  return result + (remaining ? '0\ufffd' : '');
}
export function decodeRemainingCharset(bytes: Uint8Array, name: string): string {
  const key = nameKey(name);
  if (key === 'binary') return rawString(bytes);
  if (key === 'hex') return Array.from(bytes, byte => byte.toString(16).padStart(2,'0')).join('');
  if (key === 'base64') return toBase64(bytes);
  if (key === 'cesu8') return decodeCesu8(bytes);
  if (key === 'utf7' || key === 'unicode11utf7' || key === 'utf7imap') return decodeUtf7(bytes,key === 'utf7imap');
  throw new Error('UNSUPPORTED_CHARSET');
}
/** iconv's auto UTF-16 selects a BOM, otherwise counts ASCII-looking code units. */
export function decodeAutoUtf16(bytes: Uint8Array): string {
  let little = true;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) little = true;
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) little = false;
  else {
    let le = 0, be = 0;
    for (let i = 0; i + 1 < bytes.length && i < 200; i += 2) {
      if (bytes[i] !== 0 && bytes[i+1] === 0) le++;
      else if (bytes[i] === 0 && bytes[i+1] !== 0) be++;
    }
    little = le >= be;
  }
  return decodeRawUtf16(bytes,little);
}
export function encodeRemainingCharset(value: string, name: string): number[] {
  const key = nameKey(name);
  if (key === 'binary') return Array.from({length:value.length},(_,i)=>value.charCodeAt(i) & 255);
  if (key === 'hex') {
    const result: number[] = [];
    for (let i = 0; i + 1 < value.length; i += 2) {
      const pair = String.fromCharCode(value.charCodeAt(i) & 255, value.charCodeAt(i+1) & 255);
      if (!/^[\da-f]{2}$/i.test(pair)) break;
      result.push(parseInt(pair,16));
    }
    return result;
  }
  if (key === 'base64') {
    const end = value.length - value.length % 4;
    return [...fromBase64(value.slice(0,end)), ...fromBase64(value.slice(end))];
  }
  if (key === 'cesu8') {
    const result: number[] = [];
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i);
      if (code < 0x80) result.push(code);
      else if (code < 0x800) result.push(0xc0 | (code >> 6),0x80 | (code & 63));
      else result.push(0xe0 | (code >> 12),0x80 | ((code >> 6) & 63),0x80 | (code & 63));
    }
    return result;
  }
  if (key === 'utf7' || key === 'unicode11utf7' || key === 'utf7imap') return encodeUtf7(value,key === 'utf7imap');
  throw new Error('UNSUPPORTED_CHARSET');
}
