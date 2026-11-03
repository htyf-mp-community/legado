/** Decode UTF-16 code units as the former iconv TXT/fallback decoder did. */
export function decodeRawUtf16(bytes: Uint8Array, little: boolean): string {
  const chunks: string[] = [], units: number[] = [];
  for (let index = 0; index + 1 < bytes.length; index += 2) {
    units.push(little ? bytes[index] | (bytes[index + 1] << 8) : (bytes[index] << 8) | bytes[index + 1]);
    if (units.length === 4096) { chunks.push(String.fromCharCode(...units)); units.length = 0; }
  }
  if (units.length) chunks.push(String.fromCharCode(...units));
  return chunks.join('');
}
