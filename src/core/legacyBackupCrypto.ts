import { createDecipheriv, createHash } from 'react-native-quick-crypto';
import { decodeSourceCharset } from './sourceCharsetDecode';

function envelope(value: string): Uint8Array {
  // SecureUtil.decode selects hex before Hutool's permissive standard/URL-safe Base64.
  // Do not trim: spaces around hex make the native decoder choose Base64 instead.
  if (/^[\da-fA-F]+$/.test(value)) {
    const hex = value.length % 2 ? '0' + value : value;
    return Uint8Array.from(hex.match(/../g)!, pair => parseInt(pair, 16));
  }
  const alphabet =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
    values: number[] = [];
  for (const char of value) {
    const code = char.charCodeAt(0);
    // Hutool 5.8.22 indexes an ASCII table of length 123; UTF-8 high bytes are skipped.
    if (code >= 123 && code < 128) throw new Error('Invalid Base64 character');
    const digit =
      char === '-' ? 62 : char === '_' ? 63 : alphabet.indexOf(char);
    if (digit >= 0) values.push(digit);
  }
  const bytes: number[] = [];
  for (let i = 0; i < values.length; i += 4) {
    if (i + 1 < values.length)
      bytes.push((values[i] << 2) | (values[i + 1] >>> 4));
    if (i + 2 < values.length)
      bytes.push(((values[i + 1] & 15) << 4) | (values[i + 2] >>> 2));
    if (i + 3 < values.length)
      bytes.push(((values[i + 2] & 3) << 6) | values[i + 3]);
  }
  return Uint8Array.from(bytes);
}

/**
 * BackupAES/Hutool AES-128-ECB/PKCS5 envelope, using the first 16 lowercase MD5 hex bytes.
 * Password blankness is enforced by sensitive-file preflight; legacy servers may use an
 * empty key password. Supports native hex and permissive Base64 envelopes, with no writes.
 */
export function decryptLegacyBackupText(value: string, password: string) {
  try {
    const hash = createHash('md5');
    hash.update(password, 'utf8');
    const key = hash.digest('hex').slice(0, 16),
      decipher = createDecipheriv('aes-128-ecb', key, new Uint8Array(0));
    decipher.setAutoPadding(true);
    const encrypted = envelope(value);
    // SunJCE/Hutool returns an empty byte array for an empty encrypted message.
    if (!encrypted.length) return '';
    const first = decipher.update(encrypted),
      last = decipher.final();
    const bytes = new Uint8Array(first.length + last.length);
    bytes.set(first);
    bytes.set(last, first.length);
    return decodeSourceCharset(bytes, 'UTF-8');
  } catch {
    throw new Error('旧版备份密码错误或加密数据已损坏');
  }
}
