type Order = 'auto' | 'le' | 'be';

export function utf32Order(name: string): Order | undefined {
  const key = name.toLowerCase().replace(/:\d{4}$|[^0-9a-z]/g, '');
  if (key === 'utf32' || key === 'ucs4') return 'auto';
  if (key === 'utf32le' || key === 'ucs4le') return 'le';
  if (key === 'utf32be' || key === 'ucs4be') return 'be';
  return undefined;
}

function detectLittleEndian(bytes: Uint8Array): boolean {
  if (bytes.length >= 4) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe && bytes[2] === 0 && bytes[3] === 0) return true;
    if (bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 0xfe && bytes[3] === 0xff) return false;
  }
  let le = 0, be = 0;
  for (let i = 0; i + 3 < bytes.length && i < 400; i += 4) {
    const [a, b, c, d] = bytes.subarray(i, i + 4);
    if (a !== 0 || b > 0x10) be--;
    if (d !== 0 || c > 0x10) le--;
    if (a === 0 && b === 0 && (c !== 0 || d !== 0)) be++;
    if ((a !== 0 || b !== 0) && c === 0 && d === 0) le++;
  }
  return le >= be;
}

/** Decode as the prior UTF-32 fallback, including isolated surrogate units. */
export function decodeUtf32Compatibility(bytes: Uint8Array, order: Order): string {
  const little = order === 'auto' ? detectLittleEndian(bytes) : order === 'le';
  const chunks: string[] = [];
  let result = '';
  for (let i = 0; i < bytes.length; i += 4) {
    if (i + 3 >= bytes.length) { result += '\ufffd'; break; }
    const code = (little ? (bytes[i] | bytes[i+1] << 8 | bytes[i+2] << 16 | bytes[i+3] << 24)
      : (bytes[i] << 24 | bytes[i+1] << 16 | bytes[i+2] << 8 | bytes[i+3])) >>> 0;
    result += code > 0x10ffff ? '\ufffd' : code < 0x10000 ? String.fromCharCode(code) : String.fromCodePoint(code);
    if (result.length >= 8192) { chunks.push(result); result = ''; }
  }
  if (result) chunks.push(result);
  return chunks.join('');
}

/** Java source URL behavior replaces unpaired surrogates before encoding. */
export function encodeUtf32Source(value: string, order: Order): number[] {
  const little = order !== 'be', bytes: number[] = order === 'auto' ? [0xff, 0xfe, 0, 0] : [];
  for (let i = 0; i < value.length; i++) {
    let code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) { code = 0x10000 + ((code - 0xd800) << 10) + next - 0xdc00; i++; }
      else code = 0x3f;
    } else if (code >= 0xdc00 && code <= 0xdfff) code = 0x3f;
    if (little) bytes.push(code & 255, code >>> 8 & 255, code >>> 16 & 255, code >>> 24);
    else bytes.push(code >>> 24, code >>> 16 & 255, code >>> 8 & 255, code & 255);
  }
  return bytes;
}
