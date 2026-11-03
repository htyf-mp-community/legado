const mockValues = new Map<string, string | number | boolean>();
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getAllKeys: () => [...mockValues.keys()],
    getString: (key: string) =>
      typeof mockValues.get(key) === 'string' ? mockValues.get(key) : undefined,
    getNumber: (key: string) =>
      typeof mockValues.get(key) === 'number' ? mockValues.get(key) : undefined,
    getBoolean: (key: string) =>
      typeof mockValues.get(key) === 'boolean'
        ? mockValues.get(key)
        : undefined,
    set: (key: string, value: string | number | boolean) =>
      mockValues.set(key, value),
    clearAll: () => mockValues.clear(),
  }),
}));
jest.mock('react-native-quick-crypto', () => require('node:crypto'));
import { createBackup, parseBackup, restoreBackup } from '../src/data/backup';
import { appStorage } from '../src/data/storage';
import { encryptSensitiveBackup } from '../src/core/backupSensitive';
import {sourceRuntimeVariables} from '../src/data/runtimeSourceCache';
import {
  saveBackupPreferences,
  defaultBackupPreferences,
  loadBackupPreferences,
} from '../src/data/backupPreferences';

const cacheKey = 'legacy.runtime-source-cache.v1';
const cache =
  '[{"key":"userInfo_fixture","value":"fixture-secret-token","deadline":0}]';
const cookieKey = 'source-cookie.v1.fixture';
const cookie = '{"session":"fixture-cookie"}';
beforeEach(() => mockValues.clear());
const selectSensitive = (cookies: boolean, sourceVariables: boolean) =>
  saveBackupPreferences({
    ...defaultBackupPreferences,
    categories: {
      ...defaultBackupPreferences.categories,
      cookies,
      sourceVariables,
    },
  });

test('source variables require a password and do not appear in cleartext backups', () => {
  selectSensitive(false, true);
  appStorage.set(cacheKey, cache);
  expect(() => createBackup(appStorage, '')).toThrow('本地密码');
  const raw = createBackup(appStorage, 'fixture-password');
  expect(raw).not.toContain('fixture-secret-token');
  expect(parseBackup(raw).entries[cacheKey]).toBeUndefined();
  expect(parseBackup(raw).version).toBe(2);
});

test('new source variables use the existing encrypted backup and restore path', () => {
  selectSensitive(false, true);
  const source = sourceRuntimeVariables('https://source.example');
  source.setVariable('private-route');
  source.put('token','private-token');
  const raw=createBackup(appStorage,'fixture-password');
  expect(raw).not.toContain('private-route');
  expect(raw).not.toContain('private-token');
  mockValues.clear();
  restoreBackup(raw,appStorage,'fixture-password');
  expect(source.getVariable()).toBe('private-route');
  expect(source.get('token')).toBe('private-token');
});

test('each encrypted category can be ignored independently when restoring the other', () => {
  selectSensitive(true, true);
  appStorage.set(cacheKey, cache);
  appStorage.set(cookieKey, cookie);
  const raw = createBackup(appStorage, 'fixture-password');
  mockValues.clear();
  restoreBackup(raw, appStorage, 'fixture-password', { ignoreCookies: true });
  expect(appStorage.getString(cacheKey)).toBe(cache);
  expect(appStorage.getString(cookieKey)).toBeUndefined();
  mockValues.clear();
  restoreBackup(raw, appStorage, 'fixture-password', {
    ignoreSourceVariables: true,
  });
  expect(appStorage.getString(cookieKey)).toBe(cookie);
  expect(appStorage.getString(cacheKey)).toBeUndefined();
});

test('ignoring the only encrypted category skips its password and keeps unrelated entries', () => {
  selectSensitive(false, true);
  appStorage.set(cacheKey, cache);
  appStorage.set('fixture.setting', 'value');
  const raw = createBackup(appStorage, 'fixture-password');
  mockValues.clear();
  restoreBackup(raw, appStorage, '', { ignoreSourceVariables: true });
  expect(appStorage.getString('fixture.setting')).toBe('value');
  expect(appStorage.getString(cacheKey)).toBeUndefined();
});

test('disabled source variables are excluded and do not require a password', () => {
  appStorage.set(cacheKey, cache);
  saveBackupPreferences({
    ...defaultBackupPreferences,
    categories: {
      ...defaultBackupPreferences.categories,
      sourceVariables: false,
    },
  });
  const raw = createBackup(appStorage, '');
  expect(raw).not.toContain('fixture-secret-token');
  expect(parseBackup(raw).entries[cacheKey]).toBeUndefined();
});

test('historical unencrypted source-variable entries remain readable and honor ignore', () => {
  const raw = createBackup(appStorage, '');
  const old = JSON.parse(raw);
  old.entries[cacheKey] = { type: 'string', value: cache };
  restoreBackup(JSON.stringify(old), appStorage, '');
  expect(appStorage.getString(cacheKey)).toBe(cache);
  mockValues.clear();
  restoreBackup(JSON.stringify(old), appStorage, '', {
    ignoreSourceVariables: true,
  });
  expect(appStorage.getString(cacheKey)).toBeUndefined();
});

test('a wrong password does not commit ordinary or encrypted entries', () => {
  selectSensitive(false, true);
  appStorage.set(cacheKey, cache);
  appStorage.set('fixture.setting', 'from-backup');
  const raw = createBackup(appStorage, 'fixture-password');
  mockValues.clear();
  appStorage.set('fixture.setting', 'original');
  const before = [...mockValues];
  expect(() => restoreBackup(raw, appStorage, 'wrong-password')).toThrow();
  expect([...mockValues]).toEqual(before);
});

test('old format remains version 1 and cannot claim to carry version 2 encrypted variables', () => {
  const old = JSON.parse(createBackup(appStorage, ''));
  expect(old.version).toBe(1);
  old.encryptedSourceVariables = {
    algorithm: 'legado-aes-128-ecb-md5',
    value: 'ciphertext',
  };
  expect(() => parseBackup(JSON.stringify(old))).toThrow('版本');
});

test('version 2 cannot silently drop its encrypted source-variable data', () => {
  selectSensitive(false, true);
  appStorage.set(cacheKey, cache);
  const payload = JSON.parse(createBackup(appStorage, 'fixture-password'));
  delete payload.encryptedSourceVariables;
  expect(() => parseBackup(JSON.stringify(payload))).toThrow('敏感数据');
});

test('malformed encrypted variable entries cannot inject other storage keys or partially restore settings', () => {
  selectSensitive(false, true);
  appStorage.set(cacheKey, cache);
  const payload = JSON.parse(createBackup(appStorage, 'fixture-password'));
  payload.entries['fixture.setting'] = { type: 'string', value: 'changed' };
  payload.encryptedSourceVariables.value = encryptSensitiveBackup(
    JSON.stringify({ 'fixture.injected': { type: 'string', value: 'bad' } }),
    'fixture-password',
  );
  mockValues.clear();
  appStorage.set('fixture.setting', 'original');
  const before = [...mockValues];
  expect(() =>
    restoreBackup(JSON.stringify(payload), appStorage, 'fixture-password'),
  ).toThrow('不允许');
  expect([...mockValues]).toEqual(before);
});

test('ignoring encrypted variables bypasses a corrupted variable payload while restoring cookies', () => {
  selectSensitive(true, true);
  appStorage.set(cacheKey, cache);
  appStorage.set(cookieKey, cookie);
  const payload = JSON.parse(createBackup(appStorage, 'fixture-password'));
  payload.encryptedSourceVariables.value = 'corrupt';
  mockValues.clear();
  restoreBackup(JSON.stringify(payload), appStorage, 'fixture-password', {
    ignoreSourceVariables: true,
  });
  expect(appStorage.getString(cookieKey)).toBe(cookie);
  expect(appStorage.getString(cacheKey)).toBeUndefined();
});

describe('native sensitive backup selection', () => {
  test('new and partially stored preferences default sensitive categories to off', () => {
    expect(defaultBackupPreferences.categories.cookies).toBe(false);
    expect(defaultBackupPreferences.categories.sourceVariables).toBe(false);
    appStorage.set(
      'backup.preferences.v1',
      JSON.stringify({ categories: { cookies: true } }),
    );
    expect(loadBackupPreferences().categories.cookies).toBe(true);
    expect(loadBackupPreferences().categories.sourceVariables).toBe(false);
  });

  test.each([
    [true, false, '备份或恢复持久 Cookie 前，请先设置非空的本地密码。'],
    [false, true, '备份或恢复源变量前，请先设置非空的本地密码。'],
    [true, true, '备份或恢复持久 Cookie 前，请先设置非空的本地密码。'],
  ])(
    'enabled empty categories require a password with native precedence',
    (cookies, sourceVariables, message) => {
      selectSensitive(cookies, sourceVariables);
      const before = [...mockValues];
      for (const blank of ['', '  ', '\t\n', '\u00a0\u3000'])
        expect(() => createBackup(appStorage, blank)).toThrow(message);
      expect([...mockValues]).toEqual(before);
    },
  );

  test('empty selected categories produce encrypted containers and round-trip safely', () => {
    selectSensitive(true, true);
    const payload = parseBackup(createBackup(appStorage, 'fixture-password'));
    expect(payload.version).toBe(2);
    expect(payload.encryptedEntries?.value).toBeTruthy();
    expect(payload.encryptedSourceVariables?.value).toBeTruthy();
    mockValues.clear();
    restoreBackup(JSON.stringify(payload), appStorage, 'fixture-password');
    expect(appStorage.getString(cacheKey)).toBeUndefined();
    expect(appStorage.getString(cookieKey)).toBeUndefined();
  });

  test('both disabled categories permit no password even when private data exists', () => {
    appStorage.set(cacheKey, cache);
    appStorage.set(cookieKey, cookie);
    selectSensitive(false, false);
    const payload = parseBackup(createBackup(appStorage, ''));
    expect(payload.version).toBe(1);
    expect(payload.encryptedEntries).toBeUndefined();
    expect(payload.encryptedSourceVariables).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain('fixture-secret-token');
    expect(JSON.stringify(payload)).not.toContain('fixture-cookie');
  });
});
