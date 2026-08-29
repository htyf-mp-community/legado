jest.mock('react-native-quick-crypto', () => ({
  createHash: () => ({ update: () => undefined, digest: () => '0123456789abcdef0123456789abcdef' }),
  createDecipheriv: (algorithm: string, key: string, iv: Uint8Array) => {
    if (algorithm !== 'aes-128-ecb' || key !== '0123456789abcdef' || iv.length !== 0) throw new Error('envelope mismatch');
    return { setAutoPadding: () => undefined, update: (value: string, input: string, output: string) => value === 'YmFzZTY0' && input === 'base64' && output === 'utf8' ? '解密' : '', final: () => '成功' };
  },
}));
import { decryptLegacyBackupText } from '../src/core/legacyBackupCrypto';

test('matches Legado BackupAES MD5-key AES-128-ECB envelope', () => expect(decryptLegacyBackupText('YmFzZTY0', '密码')).toBe('解密成功'));
test('requires a password before decrypting', () => expect(() => decryptLegacyBackupText('x', '')).toThrow('需要密码'));
