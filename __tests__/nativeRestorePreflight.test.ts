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
jest.mock('@dr.pogodin/react-native-fs', () => ({
  CachesDirectoryPath: '/cache',
  DocumentDirectoryPath: '/docs',
  exists: jest.fn(async () => false),
  readDir: jest.fn(),
  readFile: jest.fn(),
  unlink: jest.fn(),
  mkdir: jest.fn(),
  copyFile: jest.fn(),
}));
jest.mock('@react-native-documents/picker', () => ({
  keepLocalCopy: jest.fn(),
}));
jest.mock('react-native-nitro-unzip', () => ({ getUnzip: jest.fn() }));

import { createCipheriv, createHash } from 'react-native-quick-crypto';
import { readDir, readFile } from '@dr.pogodin/react-native-fs';
import { inspectLegacyBackupDirectory } from '../src/core/legacyBackupArchive';
import {
  parseNativeCookieBackup,
  parseNativeRuntimeSourceCacheBackup,
} from '../src/core/nativeBackupSensitive';
import { preflightNativeBackupFiles } from '../src/core/nativeBackupPreflight';
import { decryptLegacyBackupText } from '../src/core/legacyBackupCrypto';
import native from './fixtures/nativeRestorePreflight.native.json';
import { convertLegacyBackup } from '../src/data/legacyBackup';
import { restoreBackupPreview } from '../src/core/restoreBackupPreview';

const encrypt = (raw: string, password = 'fixture-password') => {
  const key = createHash('md5').update(password).digest('hex').slice(0, 16);
  const cipher = createCipheriv('aes-128-ecb', key, new Uint8Array(0));
  return cipher.update(raw, 'utf8', 'base64') + cipher.final('base64');
};
function archive(files: Record<string, string>) {
  jest.mocked(readDir).mockResolvedValue(
    Object.keys(files).map(name => ({
      name,
      path: '/stage/' + name,
      isFile: () => true,
      isDirectory: () => false,
    })) as never,
  );
  jest
    .mocked(readFile)
    .mockImplementation(async path => files[String(path).split('/').pop()!]);
}
beforeEach(() => {
  jest.clearAllMocks();
  mockValues.clear();
});

test('wrong encrypted-cookie password rejects the whole native preview before a valid source can be restored', async () => {
  archive({
    'bookSource.json':
      '[{"bookSourceUrl":"https://fixture.invalid","bookSourceName":"source"}]',
    'cookies.json': encrypt(
      '[{"url":"fixture.invalid","cookie":"sid=fixture"}]',
    ),
  });
  await expect(
    inspectLegacyBackupDirectory('/stage', 'wrong-password'),
  ).rejects.toThrow();
  expect(mockValues.size).toBe(0);
});

test('plain source-variable data still requires the nonblank native local password before other data', async () => {
  archive({
    'bookSource.json':
      '[{"bookSourceUrl":"https://fixture.invalid","bookSourceName":"source"}]',
    'runtimeSourceCache.json':
      '[{"key":"v_fixture","value":"fixture","deadline":0}]',
  });
  await expect(inspectLegacyBackupDirectory('/stage', '')).rejects.toThrow(
    '源变量',
  );
  expect(mockValues.size).toBe(0);
});

test('invalid strict sensitive rows reject rather than being filtered or converted into import warnings', async () => {
  for (const [name, raw] of [
    ['cookies.json', '[{"url":"fixture.invalid","cookie":null}]'],
    ['cookies.json', '[null]'],
    ['cookies.json', '[{"url":"fixture.invalid","cookie":"fixture"},]'],
    [
      'runtimeSourceCache.json',
      '[{"key":"v_fixture","value":"fixture","deadline":1.5}]',
    ],
    [
      'runtimeSourceCache.json',
      '[{"key":"ordinary","value":"fixture","deadline":0}]',
    ],
  ]) {
    archive({ 'bookSource.json': '[]', [name]: encrypt(raw) });
    await expect(
      inspectLegacyBackupDirectory('/stage', 'fixture-password'),
    ).rejects.toThrow();
  }
});

test('all finite strict-parser outcomes match unchanged native Gson and parser functions', () => {
  for (const row of native.cases) {
    const parse = () =>
      row.kind === 'cookies'
        ? parseNativeCookieBackup(row.raw)
        : parseNativeRuntimeSourceCacheBackup(row.raw).map(value => ({
            ...value,
            deadline: String(value.deadline),
          }));
    if ('error' in row) expect(parse).toThrow();
    else
      expect({ raw: row.raw, rows: parse() }).toEqual({
        raw: row.raw,
        rows: row.rows,
      });
  }
});

test('all finite native BackupAES/Hutool envelope results match real cryptography', () => {
  for (const row of native.envelopes) {
    const decrypt = () => decryptLegacyBackupText(row.encoded, row.password);
    if (row.accepted)
      expect({ encoded: row.encoded, plaintext: decrypt() }).toEqual({
        encoded: row.encoded,
        plaintext: row.plaintext,
      });
    else expect(decrypt).toThrow();
  }
});

test('native preflight validates cookies before caches regardless of archive listing order and never exposes secret values', () => {
  const files = {
    'runtimeSourceCache.json': encrypt(
      '[{"key":"ordinary","value":"fixture-secret","deadline":0}]',
    ),
    'cookies.json': encrypt('[{"url":null,"cookie":"fixture-secret"}]'),
  };
  try {
    preflightNativeBackupFiles(files, 'fixture-password');
    throw new Error('Expected failure');
  } catch (error) {
    expect(error).toMatchObject({ file: 'cookies.json' });
    expect(String(error)).not.toContain('fixture-secret');
    expect(String(error)).not.toContain('fixture-password');
  }
});

test('ignored sensitive files bypass invalid content and password requirements without mutating the input', async () => {
  const files = {
    'cookies.json': 'invalid',
    'runtimeSourceCache.json': 'invalid',
    'bookshelf.json': '[]',
  };
  expect(
    preflightNativeBackupFiles(files, '', {
      ignoreCookies: true,
      ignoreSourceVariables: true,
    }),
  ).toEqual({ 'bookshelf.json': '[]' });
  expect(files['cookies.json']).toBe('invalid');
  archive(files);
  const preview = await inspectLegacyBackupDirectory('/stage', '', 'ignored', {
    ignoreCookies: true,
    ignoreSourceVariables: true,
  });
  expect(preview.warnings).toEqual([]);
  expect(readFile).toHaveBeenCalledTimes(1);
});

test('native legacy plaintext cache arrays accept a nonblank password without trying AES, including exact Longs and duplicate key replacement', () => {
  const raw =
    '[{"key":"v_a","value":"old","deadline":0},{"key":"v_b","value":null,"deadline":9223372036854775807},{"key":"v_a","value":"new","deadline":9007199254740993}]';
  const result = preflightNativeBackupFiles(
    { 'runtimeSourceCache.json': raw },
    'fixture-password',
  );
  expect(
    parseNativeRuntimeSourceCacheBackup(result['runtimeSourceCache.json']),
  ).toEqual([
    { key: 'v_a', value: 'new', deadline: '9007199254740993' },
    { key: 'v_b', value: null, deadline: '9223372036854775807' },
  ]);
  for (const password of ['', ' ', '\u00a0', '\u001c', '\u3000'])
    expect(() =>
      preflightNativeBackupFiles({ 'runtimeSourceCache.json': raw }, password),
    ).toThrow('源变量');
});

test('empty validated native cache/cookie lists do not materialize persistent rows', async () => {
  archive({
    'cookies.json': encrypt('[]'),
    'runtimeSourceCache.json': encrypt('[]'),
  });
  const preview = await inspectLegacyBackupDirectory(
    '/stage',
    'fixture-password',
  );
  expect(preview.importedFiles).toEqual(
    expect.arrayContaining(['cookies.json', 'runtimeSourceCache.json']),
  );
  expect(preview.payload.entries).toEqual({});
  expect(
    convertLegacyBackup({ 'runtimeSourceCache.json': '[]' }).payload.entries,
  ).toEqual({});
});

test('default local/archive inspection reads the configured local password without changing or including it', async () => {
  mockValues.set('backup.local-password.v1', 'fixture-password');
  archive({
    'cookies.json': encrypt('[]'),
    'runtimeSourceCache.json': encrypt('[]'),
  });
  const preview = await inspectLegacyBackupDirectory('/stage');
  expect(preview.payload.entries).toEqual({});
  expect(mockValues.get('backup.local-password.v1')).toBe('fixture-password');
});

test('failed native preflight cannot change an existing source or any typed application value through preview and restore', async () => {
  mockValues.set(
    'sources.v1',
    '[{"bookSourceUrl":"https://fixture.invalid","bookSourceName":"original","customOrder":9}]',
  );
  mockValues.set('fixture.boolean', false);
  mockValues.set('fixture.number', 0);
  const before = [...mockValues];
  archive({
    'bookSource.json':
      '[{"bookSourceUrl":"https://fixture.invalid","bookSourceName":"changed","customOrder":4}]',
    'runtimeSourceCache.json': encrypt(
      '[{"key":"ordinary","value":"fixture","deadline":0}]',
    ),
  });
  await expect(
    (async () => {
      const preview = await inspectLegacyBackupDirectory(
        '/stage',
        'fixture-password',
      );
      await restoreBackupPreview({
        raw: JSON.stringify(preview.payload),
        payload: preview.payload,
        legacyFiles: preview.importedFiles,
      });
    })(),
  ).rejects.toThrow('runtimeSourceCache.json');
  expect([...mockValues]).toEqual(before);
});

test('valid encrypted cache data survives the actual native preview/restore path and preserves local-only cache rows', async () => {
  mockValues.set(
    'legacy.runtime-source-cache.v1',
    '[{"key":"v_local","value":"keep","deadline":0},{"key":"v_fixture","value":"old","deadline":1}]',
  );
  archive({
    'cookies.json': encrypt('[]'),
    'runtimeSourceCache.json': encrypt(
      '[{"key":"v_fixture","value":"new","deadline":9007199254740993},{"key":"v_null","value":null,"deadline":0}]',
    ),
  });
  const preview = await inspectLegacyBackupDirectory(
    '/stage',
    'fixture-password',
  );
  await restoreBackupPreview({
    raw: JSON.stringify(preview.payload),
    payload: preview.payload,
    legacyFiles: preview.importedFiles,
  });
  expect(
    JSON.parse(String(mockValues.get('legacy.runtime-source-cache.v1'))),
  ).toEqual([
    { key: 'v_local', value: 'keep', deadline: 0 },
    { key: 'v_fixture', value: 'new', deadline: '9007199254740993' },
    { key: 'v_null', value: null, deadline: 0 },
  ]);
});
