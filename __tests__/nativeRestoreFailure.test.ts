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
jest.mock('react-native-quick-crypto', () => ({}));
jest.mock('../src/data/appLog', () => ({ addAppLog: jest.fn() }));
jest.mock('../src/core/legacyBackupArchive', () => ({
  activateLegacyMedia: jest.fn(),
  commitLegacyMedia: jest.fn(),
  discardLegacyMedia: jest.fn(),
}));
import native from './fixtures/nativeRestoreFailure.native.json';
import { convertLegacyBackup } from '../src/data/legacyBackup';
import { restoreBackupPreview } from '../src/core/restoreBackupPreview';
import {
  restoreLegacyBackup,
  LegacyRestoreError,
} from '../src/data/legacyRestore';
import { appStorage } from '../src/data/storage';
import { addAppLog } from '../src/data/appLog';
import {
  activateLegacyMedia,
  commitLegacyMedia,
  discardLegacyMedia,
} from '../src/core/legacyBackupArchive';
import { restoreBackup, type BackupPayload } from '../src/data/backup';

beforeEach(() => {
  mockValues.clear();
  jest.clearAllMocks();
  jest.mocked(addAppLog).mockReset();
  jest.mocked(activateLegacyMedia).mockImplementation(async () => {});
  jest.mocked(commitLegacyMedia).mockImplementation(async plan => {
    plan.committed = true;
  });
});
afterEach(() => jest.restoreAllMocks());

const payload = (entries: BackupPayload['entries']) =>
  JSON.stringify({
    format: 'legado-htyf-backup',
    version: 1,
    storageId: 'io.legado.htyf.application-storage',
    createdAt: 1,
    entries,
  });
const entry = (value: unknown) => ({
  type: 'string' as const,
  value: JSON.stringify(value),
});

test('native ZIP restore retains the source/record prefix committed before an invalid record, and does not reach later categories', async () => {
  mockValues.set(
    'sources.v1',
    '[{"bookSourceUrl":"https://source.invalid","bookSourceName":"existing","customOrder":9}]',
  );
  mockValues.set(
    'reading.records.v1',
    '[{"deviceId":"remote","bookName":"Same","author":"甲","readTime":1000,"lastRead":1}]',
  );
  const preview = convertLegacyBackup({
    'bookSource.json':
      '[{"bookSourceUrl":"https://source.invalid","bookSourceName":"existing","customOrder":4}]',
    'readRecord.json':
      '[{"deviceId":"remote","bookName":"Same","author":"甲","readTime":2000,"lastRead":2},{"bookName":"invalid","author":null},{"bookName":"late"}]',
    'servers.json': '[]',
  });
  await expect(
    restoreBackupPreview({
      raw: JSON.stringify(preview.payload),
      payload: preview.payload,
      legacyFiles: preview.importedFiles,
    }),
  ).rejects.toThrow();
  expect(JSON.parse(String(mockValues.get('sources.v1')))[0].customOrder).toBe(
    4,
  );
  expect(JSON.parse(String(mockValues.get('reading.records.v1')))).toEqual([
    {
      deviceId: 'remote',
      bookName: 'Same',
      author: '甲',
      readTime: 2000,
      lastRead: 2,
    },
  ]);
  expect(mockValues.has('legacy.servers.v1')).toBe(false);
});

test('native preview state after each failed/successful record sequence matches the unchanged source loop and DAO', async () => {
  for (const row of native.cases) {
    mockValues.clear();
    mockValues.set('reading.record-device.v1', row.ownDeviceId);
    mockValues.set('reading.records.v1', JSON.stringify(row.current));
    const preview = convertLegacyBackup({
      'readRecord.json': JSON.stringify(row.incoming),
    });
    let failed = false;
    try {
      await restoreBackupPreview({
        raw: JSON.stringify(preview.payload),
        payload: preview.payload,
        legacyFiles: preview.importedFiles,
      });
    } catch {
      failed = true;
    }
    expect({
      input: row.incoming,
      failed,
      records: JSON.parse(String(mockValues.get('reading.records.v1'))),
    }).toEqual({
      input: row.incoming,
      failed: row.expected.failed,
      records: row.expected.rows,
    });
  }
});

test('ordinary HTYF restore remains atomic even if serialized input claims to be a native archive', () => {
  mockValues.set(
    'sources.v1',
    '[{"bookSourceUrl":"https://old.invalid","bookSourceName":"old"}]',
  );
  const before = Object.fromEntries(mockValues);
  const raw = JSON.parse(
    payload({
      'sources.v1': entry([
        { bookSourceUrl: 'https://new.invalid', bookSourceName: 'new' },
      ]),
      'reading.records.v1': entry([{ bookName: 'bad', author: null }]),
    }),
  );
  raw.legacyFiles = ['readRecord.json'];
  expect(() => restoreBackup(JSON.stringify(raw))).toThrow('不能为 null');
  expect(Object.fromEntries(mockValues)).toEqual(before);
});

test('a failed record storage unit rolls back only that unit, retaining prior typed values and the successful record prefix', async () => {
  mockValues.set('reading.record-device.v1', 'own');
  mockValues.set('bookshelf.manage.delete-original.v1', false);
  mockValues.set('bookshelf.sort.v1', 4);
  mockValues.set('storage.value-types.v1', '{"untyped":"number"}');
  mockValues.set('untyped', 7);
  const originalSet = appStorage.set.bind(appStorage);
  let writes = 0,
    failed = false;
  jest.spyOn(appStorage, 'set').mockImplementation((key, value) => {
    originalSet(key, value);
    if (key === 'reading.records.v1' && ++writes === 2 && !failed) {
      failed = true;
      throw new Error('second record write failed');
    }
  });
  const raw = payload({
    'reading.records.v1': entry([
      {
        deviceId: 'remote',
        bookName: 'Same',
        author: '甲',
        readTime: 1000,
        lastRead: 1,
      },
      {
        deviceId: 'remote',
        bookName: 'Same',
        author: '乙',
        readTime: 2000,
        lastRead: 2,
      },
    ]),
    'legacy.servers.v1': entry([]),
  });
  await expect(restoreLegacyBackup(raw)).rejects.toMatchObject({
    name: 'LegacyRestoreError',
    committedKeys: ['reading.records.v1'],
  });
  expect(
    JSON.parse(String(mockValues.get('reading.records.v1')))[0],
  ).toMatchObject({ readTime: 1000, author: '甲', lastRead: 1 });
  expect(mockValues.get('bookshelf.manage.delete-original.v1')).toBe(false);
  expect(mockValues.get('bookshelf.sort.v1')).toBe(4);
  expect(mockValues.get('storage.value-types.v1')).toBe('{"untyped":"number"}');
  expect(mockValues.get('untyped')).toBe(7);
  expect(mockValues.get('reading.record-device.v1')).toBe('own');
  expect(mockValues.has('legacy.servers.v1')).toBe(false);
});

test('own-device lower counters with blank authors perform no insert, as in the native loop', async () => {
  const record = {
    deviceId: 'own',
    bookName: 'Same',
    author: '甲',
    readTime: 1000,
    lastRead: 1,
  };
  mockValues.set('reading.record-device.v1', 'own');
  mockValues.set('reading.records.v1', JSON.stringify([record]));
  const set = jest.spyOn(appStorage, 'set');
  const result = await restoreLegacyBackup(
    payload({
      'reading.records.v1': entry([
        { ...record, author: ' ', readTime: 2, lastRead: 9 },
      ]),
    }),
  );
  expect(result.committedKeys).toEqual([]);
  expect(set).not.toHaveBeenCalled();
  expect(mockValues.get('reading.records.v1')).toBe(JSON.stringify([record]));
});

test('book URL ownership carries from the library phase into a later bookmark phase', async () => {
  mockValues.set(
    'library.v1',
    '[{"id":"target-id","bookUrl":"https://book.invalid","name":"old"}]',
  );
  const native = convertLegacyBackup({
    'bookshelf.json':
      '[{"bookUrl":"https://book.invalid","origin":"https://source.invalid","name":"Same","author":"甲"}]',
    'bookmark.json':
      '[{"time":1,"bookName":"Same","bookAuthor":"甲","chapterIndex":0,"chapterPos":2,"bookText":"text"}]',
  });
  await restoreLegacyBackup(JSON.stringify(native.payload));
  expect(JSON.parse(String(mockValues.get('library.v1')))[0].id).toBe(
    'target-id',
  );
  expect(
    JSON.parse(String(mockValues.get('annotations.bookmarks.v1')))[0].bookId,
  ).toBe('target-id');
});

test('source-caught category failures continue later phases and diagnostics do not turn successful native restore into failure', async () => {
  const raw = payload({
    'highlight.rules.v1': entry([]),
    'sources.v1': entry([
      { bookSourceUrl: 'https://source.invalid', bookSourceName: 'source' },
    ]),
  });
  const originalSet = appStorage.set.bind(appStorage);
  jest.spyOn(appStorage, 'set').mockImplementation((key, value) => {
    if (key === 'highlight.rules.v1') throw new Error('highlight write failed');
    originalSet(key, value);
  });
  jest.mocked(addAppLog).mockImplementation(() => {
    throw new Error('diagnostic write failed');
  });
  await expect(
    restoreBackupPreview({
      raw,
      payload: JSON.parse(raw),
      legacyFiles: ['highlightRule.json', 'bookSource.json'],
    }),
  ).resolves.toMatchObject({ format: 'legado-htyf-backup' });
  expect(addAppLog).toHaveBeenCalledWith(
    '旧版备份恢复：highlight.rules.v1',
    expect.any(Error),
  );
  expect(mockValues.has('highlight.rules.v1')).toBe(false);
  expect(
    JSON.parse(String(mockValues.get('sources.v1')))[0].bookSourceName,
  ).toBe('source');
});

test('native media runs after table/preferences writes, and auto tasks run only after media succeeds', async () => {
  const raw = payload({
    'sources.v1': entry([
      { bookSourceUrl: 'https://source.invalid', bookSourceName: 'source' },
    ]),
    'reader.preferences.v1': entry({ fontSize: 22 }),
    'auto.tasks.v1': entry([{ id: 'task' }]),
  });
  const media = jest.fn(async () => {
    expect(mockValues.has('sources.v1')).toBe(true);
    expect(
      JSON.parse(String(mockValues.get('reader.preferences.v1'))).fontSize,
    ).toBe(22);
    expect(mockValues.has('auto.tasks.v1')).toBe(false);
    throw new Error('media failed');
  });
  await expect(
    restoreLegacyBackup(raw, undefined, {}, media),
  ).rejects.toMatchObject({
    name: 'LegacyRestoreError',
    committedKeys: ['sources.v1', 'reader.preferences.v1'],
  });
  expect(mockValues.has('sources.v1')).toBe(true);
  expect(mockValues.has('auto.tasks.v1')).toBe(false);
  await restoreLegacyBackup(raw, undefined, {}, async () => {});
  expect(mockValues.has('auto.tasks.v1')).toBe(true);
});

test('native preview never activates media before a failed record, and discards its unused staging session', async () => {
  const native = convertLegacyBackup({
    'readRecord.json': '[{"bookName":"first","author":"甲"},{"author":null}]',
  });
  const plan = {
    workingDirectory: '/stage',
    targetDirectory: '/new',
    directories: ['covers'],
  };
  await expect(
    restoreBackupPreview({
      raw: JSON.stringify(native.payload),
      payload: native.payload,
      legacyFiles: native.importedFiles,
      mediaPlan: plan,
    }),
  ).rejects.toBeInstanceOf(LegacyRestoreError);
  expect(activateLegacyMedia).not.toHaveBeenCalled();
  expect(commitLegacyMedia).not.toHaveBeenCalled();
  expect(discardLegacyMedia).toHaveBeenCalledWith(
    expect.objectContaining({ restoring: false }),
  );
  expect(
    JSON.parse(String(mockValues.get('reading.records.v1')))[0].bookName,
  ).toBe('first');
});

test('a second native restore waits across the first restore media await, then runs against the first committed state', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  const first = restoreLegacyBackup(
    payload({
      'sources.v1': entry([
        { bookSourceUrl: 'https://source.invalid', bookSourceName: 'first' },
      ]),
    }),
    undefined,
    {},
    () => gate,
  );
  await Promise.resolve();
  const second = restoreLegacyBackup(
    payload({
      'sources.v1': entry([
        { bookSourceUrl: 'https://source.invalid', bookSourceName: 'second' },
      ]),
    }),
  );
  await Promise.resolve();
  expect(
    JSON.parse(String(mockValues.get('sources.v1')))[0].bookSourceName,
  ).toBe('first');
  release();
  await Promise.all([first, second]);
  expect(
    JSON.parse(String(mockValues.get('sources.v1')))[0].bookSourceName,
  ).toBe('second');
});

test('native empty record/task lists do not materialize storage rows or a private device ID', async () => {
  const set = jest.spyOn(appStorage, 'set');
  const result = await restoreLegacyBackup(
    payload({ 'reading.records.v1': entry([]), 'auto.tasks.v1': entry([]) }),
  );
  expect(result.committedKeys).toEqual([]);
  expect(set).not.toHaveBeenCalled();
  expect(mockValues.size).toBe(0);
});

test('an unmapped converted category is reported before an earlier known category can mutate storage', async () => {
  mockValues.set('safe', 'keep');
  const before = Object.fromEntries(mockValues);
  await expect(
    restoreLegacyBackup(
      payload({
        'sources.v1': entry([
          { bookSourceUrl: 'https://source.invalid', bookSourceName: 'source' },
        ]),
        unknown: entry([]),
      }),
    ),
  ).rejects.toThrow('尚未支持');
  expect(Object.fromEntries(mockValues)).toEqual(before);
});

test('native preview applies ignore policy before media and keeps committed media owned when later auto tasks are written', async () => {
  mockValues.set('reader.preferences.v1', '{"fontSize":17}');
  const raw = payload({
    'sources.v1': entry([
      { bookSourceUrl: 'https://source.invalid', bookSourceName: 'source' },
    ]),
    'reader.preferences.v1': entry({ fontSize: 22 }),
    'legacy.read-config.v1': entry([{ textSize: 22 }]),
    'auto.tasks.v1': entry([{ id: 'task' }]),
  });
  const plan = {
    workingDirectory: '/stage',
    targetDirectory: '/new',
    directories: ['covers', 'bg'],
    committed: false,
  };
  jest.mocked(activateLegacyMedia).mockImplementation(async () => {
    expect(mockValues.has('sources.v1')).toBe(true);
    expect(mockValues.get('reader.preferences.v1')).toBe('{"fontSize":17}');
    expect(mockValues.has('legacy.read-config.v1')).toBe(false);
    expect(mockValues.has('auto.tasks.v1')).toBe(false);
  });
  await restoreBackupPreview(
    {
      raw,
      payload: JSON.parse(raw),
      mediaPlan: plan,
      legacyFiles: ['bookSource.json', 'readConfig.json', 'autoTask.json'],
    },
    { readConfig: true },
  );
  expect(activateLegacyMedia).toHaveBeenCalledWith(plan, ['bg']);
  expect(plan.committed).toBe(true);
  expect(mockValues.has('auto.tasks.v1')).toBe(true);
  expect(discardLegacyMedia).not.toHaveBeenCalled();
});
