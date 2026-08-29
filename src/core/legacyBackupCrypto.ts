import { createDecipheriv, createHash } from 'react-native-quick-crypto';

export function decryptLegacyBackupText(value: string, password: string) {
  if (!password) throw new Error('该旧版备份数据需要密码');
  try {
    const hash = createHash('md5');
    hash.update(password, 'utf8');
    const key = hash.digest('hex').slice(0, 16), decipher = createDecipheriv('aes-128-ecb', key, new Uint8Array(0));
    decipher.setAutoPadding(true);
    return decipher.update(value.trim(), 'base64', 'utf8') + decipher.final('utf8');
  } catch { throw new Error('旧版备份密码错误或加密数据已损坏'); }
}
