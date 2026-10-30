jest.mock('react-native-quick-crypto', () => require('node:crypto'));
import { decryptLegacyBackupText } from '../src/core/legacyBackupCrypto';
import native from './fixtures/nativeRestorePreflight.native.json';

test('decrypts native BackupAES output with MD5 hex key bytes, including an empty server password', () => {
  for (const password of ['', 'fixture-password', ' 密码 ']) {
    const row = native.envelopes.find(
      value => value.password === password && value.plaintext === '[]',
    )!;
    expect(decryptLegacyBackupText(row.encoded, password)).toBe('[]');
  }
});
test('reports wrong passwords without ciphertext or password text', () => {
  const row = native.envelopes.find(
    value => value.password === 'fixture-password' && value.plaintext === '[]',
  )!;
  expect(() => decryptLegacyBackupText(row.encoded, 'wrong-password')).toThrow(
    '旧版备份密码错误或加密数据已损坏',
  );
});
