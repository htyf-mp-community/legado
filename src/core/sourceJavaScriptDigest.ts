import { utf8Bytes } from './sourceUrlEncoding';

/** Map the Java digest names supported by the source runtime to Quick Crypto. */
export function sourceDigestAlgorithm(name: string, hmac: boolean): string | null {
  let algorithm = name.toLowerCase();
  if (hmac) {
    if (!algorithm.startsWith('hmac')) return null;
    algorithm = algorithm.slice(4);
  }
  const known: Record<string, string> = {
    md5: 'md5', sha: 'sha1', sha1: 'sha1', sha224: 'sha224', sha256: 'sha256',
    sha384: 'sha384', sha512: 'sha512', sha3224: 'sha3-224', sha3256: 'sha3-256',
    sha3384: 'sha3-384', sha3512: 'sha3-512',
  };
  return known[algorithm.replace(/[-_]/g, '')] ?? null;
}

export function sourceJavaScriptDigest(value: string, algorithm: string, encoding: 'hex' | 'base64', key?: string): string {
  const bytes = Uint8Array.from(utf8Bytes(value));
  const keyBytes = key === undefined ? undefined : Uint8Array.from(utf8Bytes(key));
  if (keyBytes && keyBytes.length === 0) throw new TypeError('JavaScript HMAC 密钥为空');
  const crypto = require('react-native-quick-crypto') as typeof import('react-native-quick-crypto');
  const hash = keyBytes === undefined ? crypto.createHash(algorithm) : crypto.createHmac(algorithm, keyBytes);
  hash.update(bytes);
  return hash.digest(encoding);
}
