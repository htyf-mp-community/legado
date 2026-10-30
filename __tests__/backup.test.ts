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
  createHash: () => ({
    update: jest.fn(),
    digest: () => '0123456789abcdef0123456789abcdef',
  }),
  createCipheriv: () => ({
    setAutoPadding: jest.fn(),
    update: (value: string) => value.split('').reverse().join(''),
    final: () => '',
  }),
  createDecipheriv: () => ({
    setAutoPadding: jest.fn(),
    update: (value: string) => value.split('').reverse().join(''),
    final: () => '',
  }),
}));

import { createBackup, parseBackup, restoreBackup } from '../src/data/backup';
import { convertLegacyBackup } from '../src/data/legacyBackup';

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

test('round-trips supported values while preserving categories absent from the backup', () => {
  const source = memory({ library: '[1]', page: 7, dark: true });
  const backup = createBackup(source.storage);
  const target = memory({ stale: 'remove me' });
  restoreBackup(backup, target.storage);
  expect(Object.fromEntries(target.values)).toEqual({
    stale: 'remove me',
    library: '[1]',
    page: 7,
    dark: true,
    'storage.value-types.v1': JSON.stringify({
      page: 'number',
      dark: 'boolean',
    }),
  });
  expect(parseBackup(createBackup(target.storage)).entries).toEqual({
    ...parseBackup(backup).entries,
    stale: { type: 'string', value: 'remove me' },
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

const encoded = (value: unknown) => JSON.stringify(value);
const backupWith = (entries: Record<string, string | number | boolean>) =>
  createBackup(memory(entries).storage);

test('upserts records by native identity and never clears an absent or empty category', () => {
  const target = memory({
    'sources.v1': encoded([
      { bookSourceUrl: 'local', name: 'keep' },
      { bookSourceUrl: 'same', name: 'old' },
    ]),
    'bookshelf.groups.v1': encoded([{ id: '1', name: 'local' }]),
    'annotations.bookmarks.v1': encoded([{ id: 'bookmark', excerpt: 'keep' }]),
  });
  restoreBackup(
    backupWith({
      'sources.v1': encoded([
        { bookSourceUrl: 'same', name: 'new' },
        { bookSourceUrl: 'remote', name: 'add' },
      ]),
      'bookshelf.groups.v1': '[]',
    }),
    target.storage,
  );
  expect(JSON.parse(target.storage.getString('sources.v1')!)).toEqual([
    { bookSourceUrl: 'local', name: 'keep' },
    { bookSourceUrl: 'same', name: 'new' },
    { bookSourceUrl: 'remote', name: 'add' },
  ]);
  expect(JSON.parse(target.storage.getString('bookshelf.groups.v1')!)).toEqual([
    { id: '1', name: 'local' },
  ]);
  expect(target.storage.getString('annotations.bookmarks.v1')).toBe(
    '[{"id":"bookmark","excerpt":"keep"}]',
  );
});
test('same book URL preserves stable target ID and remaps incoming annotation owners', () => {
  const target = memory({
    'library.v1': encoded([
      { id: 'target-id', bookUrl: 'https://book', name: 'old' },
      { id: 'unrelated', name: 'local' },
    ]),
  });
  restoreBackup(
    backupWith({
      'library.v1': encoded([
        { id: 'legacy-id', bookUrl: 'https://book', name: 'restored' },
      ]),
      'annotations.bookmarks.v1': encoded([
        { id: 'm', bookId: 'legacy-id', excerpt: 'text' },
      ]),
    }),
    target.storage,
  );
  expect(JSON.parse(target.storage.getString('library.v1')!)).toEqual([
    { id: 'target-id', bookUrl: 'https://book', name: 'restored' },
    { id: 'unrelated', name: 'local' },
  ]);
  expect(
    JSON.parse(target.storage.getString('annotations.bookmarks.v1')!)[0].bookId,
  ).toBe('target-id');
});
test('keyboard assists and highlight rules retain the native replace-all exception', () => {
  const target = memory({
    'keyboard-assists.v1': '[{"key":"old"}]',
    'highlight.rules.v1': '[{"id":1}]',
    'replace.rules.v1': '[{"id":1}]',
  });
  restoreBackup(
    backupWith({
      'keyboard-assists.v1': '[]',
      'highlight.rules.v1': '[]',
      'replace.rules.v1': '[]',
    }),
    target.storage,
  );
  expect(target.storage.getString('keyboard-assists.v1')).toBe('[]');
  expect(target.storage.getString('highlight.rules.v1')).toBe('[]');
  expect(target.storage.getString('replace.rules.v1')).toBe('[{"id":1}]');
});
test('malformed recognized records are rejected before applying any other entry', () => {
  const target = memory({ safe: 'original', 'sources.v1': '[]' });
  expect(() =>
    restoreBackup(
      backupWith({ safe: 'changed', 'sources.v1': '{"bad":true}' }),
      target.storage,
    ),
  ).toThrow();
  expect(Object.fromEntries(target.values)).toEqual({
    safe: 'original',
    'sources.v1': '[]',
  });
});
test('a failed storage write restores every previous value', () => {
  const target = memory({ a: 'old', b: true });
  const set = target.storage.set;
  let failed = false;
  target.storage.set = (key, value) => {
    if (key === 'z' && !failed) {
      failed = true;
      throw new Error('disk write failed');
    }
    return set(key, value);
  };
  expect(() =>
    restoreBackup(backupWith({ a: 'new', z: 'incoming' }), target.storage),
  ).toThrow('disk write failed');
  expect(Object.fromEntries(target.values)).toEqual({ a: 'old', b: true });
});

test('ignores only the chosen configuration fields and always retains device-specific cover/backup values', () => {
  const target = memory({
    'app.preferences.v1': encoded({
      themeMode: 'dark',
      language: 'en',
      dayPrimary: '#123456',
    }),
    'cover.preferences.v1': encoded({
      horizontal: true,
      defaultCover: 'file:///this-device/cover.png',
    }),
    'bookshelf.preferences.v1': encoded({ layout: 6, margin: 22 }),
    'general.preferences.v1': encoded({
      showRss: false,
      threadCount: 2,
      userAgent: 'local',
    }),
    'backup.preferences.v1': encoded({
      deviceName: 'local-device',
      autoBackup: false,
      webDavBookAutoRestore: false,
      onlyLatest: true,
    }),
    'reader.preferences.v1': encoded({ fontSize: 28 }),
    'backup.restore-ignore.v1': encoded({ readConfig: true }),
  });
  restoreBackup(
    backupWith({
      'app.preferences.v1': encoded({
        themeMode: 'light',
        language: 'zh-CN',
        dayPrimary: '#abcdef',
      }),
      'cover.preferences.v1': encoded({
        horizontal: false,
        defaultCover: 'file:///foreign/cover.png',
      }),
      'bookshelf.preferences.v1': encoded({ layout: 1, margin: 8 }),
      'general.preferences.v1': encoded({
        showRss: true,
        threadCount: 16,
        userAgent: 'restored',
      }),
      'backup.preferences.v1': encoded({
        deviceName: 'foreign',
        autoBackup: true,
        webDavBookAutoRestore: true,
        onlyLatest: false,
      }),
      'reader.preferences.v1': encoded({ fontSize: 12 }),
    }),
    target.storage,
    '',
    {
      readConfig: true,
      themeMode: true,
      themeConfig: true,
      coverConfig: true,
      bookshelfLayout: true,
      showRss: true,
      threadCount: true,
    },
  );
  expect(JSON.parse(target.storage.getString('app.preferences.v1')!)).toEqual({
    themeMode: 'dark',
    language: 'zh-CN',
    dayPrimary: '#123456',
  });
  expect(JSON.parse(target.storage.getString('cover.preferences.v1')!)).toEqual(
    { horizontal: true, defaultCover: 'file:///this-device/cover.png' },
  );
  expect(
    JSON.parse(target.storage.getString('bookshelf.preferences.v1')!),
  ).toEqual({ layout: 6, margin: 8 });
  expect(
    JSON.parse(target.storage.getString('general.preferences.v1')!),
  ).toEqual({ showRss: false, threadCount: 2, userAgent: 'restored' });
  expect(
    JSON.parse(target.storage.getString('backup.preferences.v1')!),
  ).toEqual({
    deviceName: 'local-device',
    autoBackup: false,
    webDavBookAutoRestore: false,
    onlyLatest: false,
  });
  expect(target.storage.getString('reader.preferences.v1')).toBe(
    '{"fontSize":28}',
  );
  expect(target.storage.getString('backup.restore-ignore.v1')).toBe(
    '{"readConfig":true}',
  );
});
test('local-book ignore retains existing local books and imports only network books', () => {
  const target = memory({
    'library.v1': encoded([{ id: 'local', origin: 'local', name: 'keep' }]),
  });
  restoreBackup(
    backupWith({
      'library.v1': encoded([
        { id: 'local', origin: 'local', name: 'changed' },
        { id: 'other-local', localUri: 'file:///x', name: 'skip' },
        { id: 'remote', origin: 'https://source', name: 'import' },
      ]),
    }),
    target.storage,
    '',
    { localBook: true },
  );
  expect(JSON.parse(target.storage.getString('library.v1')!)).toEqual([
    { id: 'local', origin: 'local', name: 'keep' },
    { id: 'remote', origin: 'https://source', name: 'import' },
  ]);
});
test('ignored encrypted cookies require no password and local-only cookies and variables survive', () => {
  const raw = backupWith({ a: 'imported' }),
    payload = JSON.parse(raw);
  payload.encryptedEntries = { algorithm: 'AES-128-ECB', value: 'undecodable' };
  // Use the actual format identifier so this exercises skip-before-decrypt, not a format error.
  const encrypted = parseBackup(
    createBackup(
      memory({ 'source-cookie.v1.other': '{"sid":"new"}' }).storage,
      'password',
    ),
  ).encryptedEntries!;
  payload.encryptedEntries.algorithm = encrypted.algorithm;
  payload.entries['source-cookie.v1.local'] = {
    type: 'string',
    value: '{"sid":"changed"}',
  };
  payload.entries['legacy.runtime-source-cache.v1'] = {
    type: 'string',
    value: '[{"key":"remote","value":"skip"}]',
  };
  const target = memory({
    'source-cookie.v1.local': '{"sid":"old"}',
    'legacy.runtime-source-cache.v1': '[{"key":"local","value":"keep"}]',
  });
  restoreBackup(encoded(payload), target.storage, '', {
    ignoreCookies: true,
    ignoreSourceVariables: true,
  });
  expect(target.storage.getString('a')).toBe('imported');
  expect(target.storage.getString('source-cookie.v1.local')).toBe(
    '{"sid":"old"}',
  );
  expect(target.storage.getString('legacy.runtime-source-cache.v1')).toBe(
    '[{"key":"local","value":"keep"}]',
  );
});

test.each([
  { origin: 'loc_book' },
  { origin: 'webDav::https://remote' },
  { nativeType: 256 },
])('native local-book representation %j is ignored', fields => {
  const target = memory({ 'library.v1': '[]' });
  restoreBackup(
    backupWith({ 'library.v1': encoded([{ id: 'native-local', ...fields }]) }),
    target.storage,
    '',
    { localBook: true },
  );
  expect(target.storage.getString('library.v1')).toBe('[]');
});

test('dictionary rules restore by name, the actual primary key, and an empty import retains local rules', () => {
  const target = memory({
    'dictionary.rules.v1': encoded([
      {
        name: 'local',
        urlRule: 'https://local/{key}',
        showRule: '',
        enabled: true,
        sortNumber: 1,
      },
      {
        name: 'same',
        urlRule: 'https://old/{key}',
        showRule: '',
        enabled: true,
        sortNumber: 2,
      },
    ]),
  });
  restoreBackup(
    backupWith({
      'dictionary.rules.v1': encoded([
        {
          name: 'same',
          urlRule: 'https://new/{key}',
          showRule: 'body',
          enabled: false,
          sortNumber: 3,
        },
      ]),
    }),
    target.storage,
  );
  expect(JSON.parse(target.storage.getString('dictionary.rules.v1')!)).toEqual([
    {
      name: 'local',
      urlRule: 'https://local/{key}',
      showRule: '',
      enabled: true,
      sortNumber: 1,
    },
    {
      name: 'same',
      urlRule: 'https://new/{key}',
      showRule: 'body',
      enabled: false,
      sortNumber: 3,
    },
  ]);
  const raw = target.storage.getString('dictionary.rules.v1');
  restoreBackup(backupWith({ 'dictionary.rules.v1': '[]' }), target.storage);
  expect(target.storage.getString('dictionary.rules.v1')).toBe(raw);
});
test('ignore reader configuration also protects the reader menu layout', () => {
  const target = memory({
    'reader.menu.config.v1': '{"top":["close"],"bottom":["chapter"]}',
  });
  restoreBackup(
    backupWith({ 'reader.menu.config.v1': '{"top":[],"bottom":[]}' }),
    target.storage,
    '',
    { readConfig: true },
  );
  expect(target.storage.getString('reader.menu.config.v1')).toBe(
    '{"top":["close"],"bottom":["chapter"]}',
  );
});

test('backs up the existing native false preference as boolean despite a successful empty-string getter', () => {
  const source = memory({
    'bookshelf.manage.delete-original.v1': false,
    empty: '',
    jsonFalse: 'false',
  });
  const getString = source.storage.getString;
  // Device 0.0.42 normal ZIP export: MMKV getString(false-key) returned ''.
  // Preserve that observed API response without using its on-disk files.
  source.storage.getString = key =>
    key === 'bookshelf.manage.delete-original.v1' ? '' : getString(key);
  const raw = createBackup(source.storage);
  expect(parseBackup(raw).entries).toEqual({
    'bookshelf.manage.delete-original.v1': { type: 'boolean', value: false },
    empty: { type: 'string', value: '' },
    jsonFalse: { type: 'string', value: 'false' },
  });
  const target = memory();
  restoreBackup(raw, target.storage);
  expect(Object.fromEntries(target.values)).toEqual(
    Object.fromEntries(source.values),
  );
});

test('reads all declared scalars with their owning getter and keeps lookalike strings unchanged', () => {
  const source = memory({
    'bookshelf.manage.open-title.v1': true,
    'bookshelf.manage.delete-original.v1': false,
    'bookshelf.sort.v1': 0,
    'bookshelf.group-sort.v1.%E4%B9%A6%E6%9E%B6': 5,
    'book-source.batch-delay-seconds.v1': 2,
    'keyboard-assists.lines.v1': 3,
    'audio.sleep.deadline.v1': 1793300000123,
    'storage.schema.version': 1,
    'bookshelf.layout.v1': 'grid',
    empty: '',
    falseText: 'false',
    zeroText: '0',
    json: '{"enabled":false}',
  });
  const getString = source.storage.getString;
  source.storage.getString = key => {
    if (typeof source.values.get(key) !== 'string' && source.values.has(key))
      throw new Error(`wrong getter: ${key}`);
    return getString(key);
  };
  const entries = parseBackup(createBackup(source.storage)).entries;
  for (const [key, value] of source.values)
    expect(entries[key]).toEqual({ type: typeof value, value });
});

test('remembers unknown imported scalar types after adapter recreation without exporting its private index', () => {
  const raw = createBackup(
    memory({
      customFalse: false,
      customTrue: true,
      customNumber: -12.75,
      customZero: 0,
    }).storage,
  );
  const target = memory({ empty: '', falseText: 'false' });
  restoreBackup(raw, target.storage);
  const getString = target.storage.getString;
  // Recreate the adapter with the observed native cross-type success. No in-memory type cache survives.
  const recreated = {
    ...target.storage,
    getString: (key: string) =>
      target.values.has(key) && typeof target.values.get(key) !== 'string'
        ? ''
        : getString(key),
  };
  const entries = parseBackup(createBackup(recreated)).entries;
  expect(entries).toEqual({
    ...parseBackup(raw).entries,
    empty: { type: 'string', value: '' },
    falseText: { type: 'string', value: 'false' },
  });
  expect(entries['storage.value-types.v1']).toBeUndefined();
  restoreBackup(
    createBackup(memory({ customFalse: 'false' }).storage),
    recreated,
  );
  expect(parseBackup(createBackup(recreated)).entries.customFalse).toEqual({
    type: 'string',
    value: 'false',
  });
});

test('preserves legacy malformed numeric strings instead of dropping keys or guessing the lost number', () => {
  const source = memory({
    'bookshelf.sort.v1': '',
    'book-source.batch-delay-seconds.v1': '',
  });
  const raw = createBackup(source.storage);
  expect(parseBackup(raw).entries).toEqual({
    'bookshelf.sort.v1': { type: 'string', value: '' },
    'book-source.batch-delay-seconds.v1': { type: 'string', value: '' },
  });
  const target = memory();
  restoreBackup(raw, target.storage);
  expect(Object.fromEntries(target.values)).toEqual(
    Object.fromEntries(source.values),
  );
});

test('rejects a forged internal type index before any write', () => {
  const target = memory({ safe: 'keep' });
  const payload = parseBackup(createBackup(memory().storage));
  const entries = {
    'storage.value-types.v1': { type: 'string', value: '{"safe":"boolean"}' },
  };
  expect(() =>
    restoreBackup(JSON.stringify({ ...payload, entries }), target.storage),
  ).toThrow('内部存储类型索引');
  expect(Object.fromEntries(target.values)).toEqual({ safe: 'keep' });
});

test('failed index write rolls back typed values and the exact previous index', () => {
  const target = memory({
    'bookshelf.manage.delete-original.v1': false,
    'bookshelf.sort.v1': 4,
  });
  restoreBackup(
    createBackup(memory({ unknown: true }).storage),
    target.storage,
  );
  const before = Object.fromEntries(target.values),
    set = target.storage.set;
  let failed = false;
  target.storage.set = (key, value) => {
    if (key === 'storage.value-types.v1' && !failed) {
      failed = true;
      throw new Error('index write failed');
    }
    return set(key, value);
  };
  expect(() =>
    restoreBackup(
      createBackup(memory({ unknown: 7, other: 'new' }).storage),
      target.storage,
    ),
  ).toThrow('index write failed');
  expect(Object.fromEntries(target.values)).toEqual(before);
});

test('read-record restore uses device/title identity, keeps foreign counters replaceable and protects local identity', () => {
  const target = memory({
    'reading.record-device.v1': 'own-device',
    'reading.record-sort.v1': 'duration',
    'reading.records.v1': encoded([
      {
        deviceId: 'own-device',
        bookName: 'Same',
        author: '甲',
        readTime: 100,
        lastRead: 10,
      },
      {
        deviceId: 'remote',
        bookName: 'Same',
        author: '乙',
        readTime: 200,
        lastRead: 20,
      },
    ]),
  });
  const incoming = parseBackup(
    backupWith({
      'reading.records.v1': encoded([
        {
          deviceId: 'own-device',
          bookName: 'Same',
          author: '乙',
          readTime: 50,
          lastRead: 30,
        },
        {
          deviceId: 'remote',
          bookName: 'Same',
          author: '甲',
          readTime: 5,
          lastRead: 40,
        },
      ]),
    }),
  );
  incoming.entries['reading.record-device.v1'] = {
    type: 'string',
    value: 'foreign',
  };
  incoming.entries['reading.record-sort.v1'] = {
    type: 'string',
    value: 'recent',
  };
  restoreBackup(encoded(incoming), target.storage);
  const rows = JSON.parse(target.storage.getString('reading.records.v1')!);
  expect(rows[0]).toMatchObject({
    deviceId: 'own-device',
    readTime: 100,
    lastRead: 10,
  });
  expect(rows[1]).toMatchObject({
    deviceId: 'remote',
    readTime: 5,
    lastRead: 40,
  });
  expect(rows[0].author).toBe('\u001eauthors:["乙","甲"]');
  expect(rows[1].author).toBe(rows[0].author);
  expect(target.storage.getString('reading.record-device.v1')).toBe(
    'own-device',
  );
  expect(target.storage.getString('reading.record-sort.v1')).toBe('duration');
  expect(
    parseBackup(createBackup(target.storage)).entries[
      'reading.record-device.v1'
    ],
  ).toBeUndefined();
});

test('native null String records fail before storage writes, preserving typed values and the private identity', () => {
  for (const field of ['deviceId', 'bookName', 'author']) {
    const target = memory({
      safe: false,
      'reading.record-device.v1': 'own',
      'reading.records.v1':
        '[{"deviceId":"own","bookName":"existing","author":"old","readTime":1,"lastRead":2}]',
      'sources.v1':
        '[{"bookSourceUrl":"https://old.invalid","bookSourceName":"old"}]',
    });
    const before = Object.fromEntries(target.values);
    const native = convertLegacyBackup({
      'readRecord.json': `[{"bookName":"would-be-added","readTime":7},{"${field}":null}]`,
      'bookSource.json':
        '[{"bookSourceUrl":"https://new.invalid","bookSourceName":"new"}]',
    });
    const set = jest.fn(target.storage.set);
    target.storage.set = set;
    expect(() =>
      restoreBackup(JSON.stringify(native.payload), target.storage),
    ).toThrow('不能为 null');
    expect(set).not.toHaveBeenCalled();
    expect(Object.fromEntries(target.values)).toEqual(before);
  }
});
