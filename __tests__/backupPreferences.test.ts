jest.mock('../src/core/remoteBackupArchive', () => ({
  uploadWebDavArchive: (config: unknown, backup: unknown, name?: unknown) =>
    mockUpload(config, backup, name),
}));
import {
  automaticBackupDue,
  automaticBackupFileName,
  runDueAutomaticBackup,
} from '../src/core/automaticBackup';
import {
  backupCategoryForKey,
  defaultBackupPreferences,
  loadBackupPreferences,
  saveBackupPreferences,
  shouldIncludeBackupKey,
} from '../src/data/backupPreferences';

const mockUpload = jest.fn(
  async (_config: unknown, _backup: unknown, _name?: unknown) => undefined,
);
jest.mock('../src/data/storage', () => {
  const values = new Map<string, string>();
  return {
    APP_STORAGE_ID: 'io.legado.htyf.application-storage',
    SENSITIVE_STORAGE_KEYS: new Set<string>(),
    ENCRYPTED_BACKUP_KEY_PREFIXES: ['source-cookie.v1.'],
    appStorage: {
      getAllKeys: () => [...values.keys()],
      getString: (key: string) => values.get(key),
      getNumber: () => undefined,
      getBoolean: () => undefined,
      set: (key: string, value: unknown) => values.set(key, String(value)),
      remove: (key: string) => values.delete(key),
      clearAll: () => values.clear(),
    },
  };
});
jest.mock('../src/data/remoteBackup', () => ({
  loadWebDavConfig: () => ({
    url: 'https://dav.test/',
    username: '',
    password: '',
    directory: 'legado',
  }),
  uploadWebDavBackup: (config: unknown, backup: unknown, name?: unknown) =>
    mockUpload(config, backup, name),
}));
jest.mock('../src/data/appLog', () => ({ addAppLog: jest.fn() }));
jest.mock('../src/data/localPassword', () => ({ loadLocalPassword: () => '' }));
jest.mock('../src/data/backup', () => ({
  createBackup: () => '{"backup":true}',
}));

test('backup keys map to user-visible Android content groups', () => {
  expect(backupCategoryForKey('library.v1')).toBe('bookshelf');
  expect(backupCategoryForKey('source-cookie.v1.a')).toBe('cookies');
  expect(backupCategoryForKey('reader.preferences.v1')).toBe('settings');
  const preferences = saveBackupPreferences({
    ...defaultBackupPreferences,
    categories: { ...defaultBackupPreferences.categories, cookies: false },
  });
  expect(loadBackupPreferences()).toEqual(preferences);
  expect(shouldIncludeBackupKey('source-cookie.v1.a', preferences)).toBe(false);
});
test('automatic backup observes the daily interval and persists success', async () => {
  saveBackupPreferences({
    ...defaultBackupPreferences,
    lastBackup: 0,
    deviceName: 'phone',
    onlyLatest: false,
  });
  expect(automaticBackupDue(1000, 1000 + 24 * 60 * 60 * 1000)).toBe(false);
  const now = Date.UTC(2026, 7, 29);
  expect(automaticBackupFileName('phone', now)).toBe(
    'backup2026-08-29-phone.zip',
  );
  expect(await runDueAutomaticBackup(now)).toBe('uploaded');
  expect(mockUpload).toHaveBeenCalledWith(
    expect.anything(),
    expect.anything(),
    'backup2026-08-29-phone.zip',
  );
  expect(loadBackupPreferences().lastBackup).toBe(now);
  expect(await runDueAutomaticBackup(now + 1)).toBe('not-due');
});

test('latest-only automatic backups use the stable ZIP name', () => {
  saveBackupPreferences({ ...defaultBackupPreferences, onlyLatest: true });
  expect(automaticBackupFileName('phone')).toBe('backup-htyf.zip');
});

test('reading history exclusion uses the actual records key and device-local sorting stays unexported', () => {
  expect(backupCategoryForKey('reading.records.v1')).toBe('history');
  const preferences = {
    ...defaultBackupPreferences,
    categories: { ...defaultBackupPreferences.categories, history: false },
  };
  expect(shouldIncludeBackupKey('reading.records.v1', preferences)).toBe(false);
  expect(shouldIncludeBackupKey('reading.record-sort.v1')).toBe(false);
});
