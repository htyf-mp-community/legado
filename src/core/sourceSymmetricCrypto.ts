import { SourceRuleError } from './errors';

/** Legacy book-source transformations implemented by the HTYF host crypto module. */
export function createSourceSymmetric(transformation: string, key: Uint8Array, iv?: Uint8Array) {
  const match = /^(AES|DES|DESede)\/(CBC|ECB)\/(PKCS5Padding|PKCS7Padding|NoPadding)$/i.exec(transformation);
  if (!match) throw new SourceRuleError('JavaScript 加密算法暂不支持');
  const family = match[1].toLowerCase(), mode = match[2].toLowerCase();
  const validKey = family === 'aes' ? [16, 24, 32].includes(key.length) : key.length === (family === 'des' ? 8 : 24);
  if (!validKey) throw new SourceRuleError('JavaScript 加密密钥长度无效');
  const blockSize = family === 'aes' ? 16 : 8;
  if (mode === 'cbc' && iv?.length !== blockSize) throw new SourceRuleError('JavaScript 加密偏移量长度无效');
  if (mode === 'ecb' && iv?.length) throw new SourceRuleError('JavaScript ECB 不支持偏移量');
  // Triple DES with identical component keys is equivalent to single DES.
  const cipherKey = family === 'des' ? new Uint8Array([...key, ...key, ...key]) : key;
  const algorithm = family === 'aes' ? `aes-${key.length * 8}-${mode}` : `des-ede3-${mode}`;
  const padding = match[3].toLowerCase() !== 'nopadding';
  return (input: Uint8Array, decrypt: boolean): Uint8Array => {
    // JCE returns an empty byte array for an empty decrypt input.
    if (decrypt && input.length === 0) return new Uint8Array(0);
    const { createCipheriv, createDecipheriv } = require('react-native-quick-crypto') as typeof import('react-native-quick-crypto');
    const cipher = decrypt
      ? createDecipheriv(algorithm, cipherKey, iv ?? new Uint8Array(0))
      : createCipheriv(algorithm, cipherKey, iv ?? new Uint8Array(0));
    cipher.setAutoPadding(padding);
    const first = cipher.update(input), last = cipher.final();
    const result = new Uint8Array(first.length + last.length);
    result.set(first);
    result.set(last, first.length);
    return result;
  };
}
