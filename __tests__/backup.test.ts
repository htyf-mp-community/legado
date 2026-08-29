jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getAllKeys: jest.fn(() => []),
    getString: jest.fn(),
    getNumber: jest.fn(),
    getBoolean: jest.fn(),
    set: jest.fn(),
    clearAll: jest.fn(),
  }),
}));
jest.mock('react-native-quick-crypto', () => ({
  createHash: () => ({ update: jest.fn(), digest: () => '0123456789abcdef0123456789abcdef' }),
  createCipheriv: () => ({ setAutoPadding: jest.fn(), update: (value: string) => value.split('').reverse().join(''), final: () => '' }),
  createDecipheriv: () => ({ setAutoPadding: jest.fn(), update: (value: string) => value.split('').reverse().join(''), final: () => '' }),
}));

import { createBackup, parseBackup, restoreBackup } from '../src/data/backup';

function memory(initial: Record<string, string | number | boolean> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    storage: {
      getAllKeys: () => [...values.keys()],
      getString: (key: string) =>
        typeof values.get(key) === 'string'
          ? (values.get(key) as string)
          : undefined,
      getNumber: (key: string) =>
        typeof values.get(key) === 'number'
          ? (values.get(key) as number)
          : undefined,
      getBoolean: (key: string) =>
        typeof values.get(key) === 'boolean'
          ? (values.get(key) as boolean)
          : undefined,
      set: (key: string, value: string | number | boolean) =>
        values.set(key, value),
      clearAll: () => values.clear(),
    },
  };
}

test('round-trips every supported value and replaces stale data', () => {
  const source = memory({ library: '[1]', page: 7, dark: true });
  const backup = createBackup(source.storage);
  const target = memory({ stale: 'remove me' });
  restoreBackup(backup, target.storage);
  expect(Object.fromEntries(target.values)).toEqual({
    library: '[1]',
    page: 7,
    dark: true,
  });
});

test('rejects malformed and foreign backups before mutating storage', () => {
  const target = memory({ keep: 'safe' });
  expect(() => restoreBackup('{', target.storage)).toThrow('JSON');
  expect(() =>
    restoreBackup(
      JSON.stringify({
        format: 'legado-htyf-backup',
        version: 1,
        createdAt: 1,
        storageId: 'foreign',
        entries: {},
      }),
      target.storage,
    ),
  ).toThrow('不属于当前应用');
  expect(Object.fromEntries(target.values)).toEqual({ keep: 'safe' });
});

test('validates entry types', () => {
  const parsed = JSON.parse(createBackup(memory().storage));
  parsed.entries.bad = { type: 'number', value: 'oops' };
  expect(() => parseBackup(JSON.stringify(parsed))).toThrow('类型无效');
});

test('does not export persisted WebDAV credentials', () => {
  const source = memory({
    library: 'books',
    'remote.webdav.password.v1': 'secret',
  });
  const payload = parseBackup(createBackup(source.storage));
  expect(payload.entries).toEqual({
    library: { type: 'string', value: 'books' },
  });
});

test('encrypts source cookies and restores them with the local password', () => {
  const source = memory({
    library: 'books',
    'source-cookie.v1.https%3A%2F%2Fexample.com': '{"sid":"secret"}',
    'backup.local-password.v1': 'never-export',
  });
  const raw = createBackup(source.storage, 'shared-password');
  const payload = parseBackup(raw);
  expect(JSON.stringify(payload)).not.toContain('sid');
  expect(JSON.stringify(payload)).not.toContain('never-export');
  const target = memory({ 'backup.local-password.v1': 'shared-password' });
  restoreBackup(raw, target.storage, 'shared-password');
  expect(Object.fromEntries(target.values)).toEqual({
    library: 'books',
    'source-cookie.v1.https%3A%2F%2Fexample.com': '{"sid":"secret"}',
    'backup.local-password.v1': 'shared-password',
  });
});

test('requires a local password when cookies are present', () => {
  const source = memory({ 'source-cookie.v1.a': '{"sid":"secret"}' });
  expect(() => createBackup(source.storage, '')).toThrow('本地密码');
});
