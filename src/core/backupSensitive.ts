import { createCipheriv, createDecipheriv, createHash } from 'react-native-quick-crypto';

export const SENSITIVE_BACKUP_ALGORITHM = 'legado-aes-128-ecb-md5';

function key(password: string) {
  if (!password) throw new Error('备份包含敏感数据，请先设置本地密码');
  const hash = createHash('md5');
  hash.update(password, 'utf8');
  return hash.digest('hex').slice(0, 16);
}

export function encryptSensitiveBackup(value: string, password: string) {
  const cipher = createCipheriv('aes-128-ecb', key(password), new Uint8Array(0));
  cipher.setAutoPadding(true);
  return cipher.update(value, 'utf8', 'base64') + cipher.final('base64');
}

export function decryptSensitiveBackup(value: string, password: string) {
  try {
    const decipher = createDecipheriv('aes-128-ecb', key(password), new Uint8Array(0));
    decipher.setAutoPadding(true);
    return decipher.update(value, 'base64', 'utf8') + decipher.final('utf8');
  } catch (error) {
    if (!password) throw error;
    throw new Error('本地密码错误或敏感备份数据已损坏');
  }
}
