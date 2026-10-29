const mockFiles = new Map<string, string>(),
  mockDirs = new Set<string>();
let mockChangeDuringCopy = false;
const mockPut = (path: string, bytes: string) => {
  mockFiles.set(path, bytes);
  let parent = path.slice(0, path.lastIndexOf('/'));
  while (parent) {
    mockDirs.add(parent);
    parent = parent.slice(0, parent.lastIndexOf('/'));
  }
};
jest.mock('@dr.pogodin/react-native-fs', () => ({
  DocumentDirectoryPath: '/docs',
  exists: async (path: string) => mockFiles.has(path) || mockDirs.has(path),
  stat: async (path: string) => {
    if (!mockFiles.has(path)) throw new Error('ENOENT');
    return { size: mockFiles.get(path)!.length, isFile: () => true };
  },
  hash: async (path: string, algorithm: string) =>
    jest
      .requireActual('node:crypto')
      .createHash(algorithm)
      .update(mockFiles.get(path))
      .digest('hex'),
  mkdir: async (path: string) => {
    mockDirs.add(path);
  },
  copyFile: jest.fn(async (source: string, target: string) => {
    if (!mockFiles.has(source)) throw new Error('ENOENT');
    mockPut(
      target,
      mockFiles.get(source)! + (mockChangeDuringCopy ? 'changed' : ''),
    );
  }),
  readDir: async (path: string) =>
    [
      ...new Set(
        [...mockDirs, ...mockFiles.keys()]
          .filter(item => item.startsWith(path + '/'))
          .map(item => item.slice(path.length + 1).split('/')[0]),
      ),
    ].map(name => ({
      name,
      path: path + '/' + name,
      isDirectory: () => mockDirs.has(path + '/' + name),
      isFile: () => mockFiles.has(path + '/' + name),
    })),
}));
import {
  prepareBackupMedia,
  restoreBackupMediaPaths,
} from '../src/core/backupMedia';
import { defaultBackupPreferences } from '../src/data/backupPreferences';
import {
  mapBackupMedia,
  validateBackupMedia,
  type BackupMediaIndex,
} from '../src/core/backupMediaPaths';
import type { BackupPayload } from '../src/data/backup';
jest.mock('../src/data/storage', () => ({
  appStorage: { getString: jest.fn() },
}));
const digest = 'a'.repeat(32),
  persisted = `/docs/covers/${digest}.cover`;
const snapshot = (): BackupPayload => ({
  format: 'legado-htyf-backup',
  version: 1,
  createdAt: 1,
  storageId: 'io.legado.htyf.application-storage',
  entries: {
    'library.v1': {
      type: 'string',
      value: JSON.stringify([
        {
          id: 'book',
          name: 'B',
          intro: 'source',
          customIntro: 'private',
          progress: 0.35,
          persistedCoverUrl: persisted,
          customCoverUrl: 'https://custom/image',
          coverUrl: 'https://source/image',
        },
      ]),
    },
    'bookshelf.groups.v1': {
      type: 'string',
      value: JSON.stringify([{ id: '1', cover: '/docs/covers/other.jpg' }]),
    },
    'reader.preferences.v1': {
      type: 'string',
      value: JSON.stringify({
        paperBackgroundImage: 'file:///docs/reading%20paper.png',
        nightBackgroundImage: '',
        fontSize: 20,
      }),
    },
    unrelated: {
      type: 'string',
      value: 'do not rewrite /docs/covers/other.jpg',
    },
  },
});
const entry = (payload: BackupPayload, key = 'library.v1') =>
  JSON.parse(String(payload.entries[key].value));
beforeEach(() => {
  mockFiles.clear();
  mockDirs.clear();
  mockChangeDuringCopy = false;
  mockPut(persisted, 'blue');
  mockPut('/docs/covers/other.jpg', 'red');
  mockPut('/docs/covers/nested/' + digest + '.cover', 'nested-other');
  mockPut('/docs/reading paper.png', 'paper');
  mockPut('/docs/bg/unreferenced.png', 'unreferenced');
});
test('archives native cover categories including unreferenced files, but only referenced reading backgrounds', async () => {
  const original = snapshot(),
    result = await prepareBackupMedia(
      original,
      '/stage',
      defaultBackupPreferences,
    );
  expect(result.media?.files).toHaveLength(4);
  expect(result.media?.references[persisted]).toBe(`covers/${digest}.cover`);
  expect(result.media?.references['/docs/reading paper.png']).toMatch(
    /^bg\/[a-f0-9]{24}-reading paper.png$/,
  );
  expect(result.media?.references['/docs/bg/unreferenced.png']).toBeUndefined();
  expect(result.entries).toEqual(original.entries);
  expect(mockFiles.get(`/stage/covers/${digest}.cover`)).toBe('blue');
});
test.each(['persistedCovers', 'otherCovers', 'backgrounds'] as const)(
  'backs up only the selected %s category',
  async category => {
    const categories = {
      ...defaultBackupPreferences.categories,
      persistedCovers: false,
      otherCovers: false,
      backgrounds: false,
      [category]: true,
    };
    const result = await prepareBackupMedia(snapshot(), '/stage', {
      ...defaultBackupPreferences,
      categories,
    });
    expect(result.media?.files).toHaveLength(
      category === 'otherCovers' ? 2 : 1,
    );
    expect(
      result.media?.files.every(file =>
        category === 'backgrounds'
          ? file.path.startsWith('bg/')
          : category === 'persistedCovers'
            ? file.path === `covers/${digest}.cover`
            : !file.path.endsWith('/' + digest + '.cover') ||
              file.path.includes('/nested/'),
      ),
    ).toBe(true);
  },
);
test('does not retain a stale manifest when all media categories are excluded', async () => {
  const categories = {
    ...defaultBackupPreferences.categories,
    persistedCovers: false,
    otherCovers: false,
    backgrounds: false,
  };
  const result = await prepareBackupMedia(
    { ...snapshot(), media: { version: 1, references: {}, files: [] } },
    '/stage',
    { ...defaultBackupPreferences, categories },
  );
  expect(result.media).toBeUndefined();
});
test('imported persistent images consolidate by actual content and retain both original references', async () => {
  const first = '/docs/LegadoImportedMedia/a/covers/' + digest + '.cover',
    second = '/docs/LegadoRestoredMedia/b/covers/' + 'b'.repeat(32) + '.cover';
  mockPut(first, 'same');
  mockPut(second, 'same');
  const result = await prepareBackupMedia(
    snapshot(),
    '/stage',
    defaultBackupPreferences,
  );
  expect(result.media?.references[first]).toBe(
    result.media?.references[second],
  );
  expect(result.media?.references[first]).toMatch(
    /^covers\/[a-f0-9]{32}\.cover$/,
  );
});
test('a file replaced during copying fails rather than recording a false digest', async () => {
  mockChangeDuringCopy = true;
  await expect(
    prepareBackupMedia(snapshot(), '/stage', defaultBackupPreferences),
  ).rejects.toThrow('发生变化');
});
test('restored paths point to the new media root while source URLs and private data remain intact', async () => {
  const archived = await prepareBackupMedia(
      snapshot(),
      '/stage',
      defaultBackupPreferences,
    ),
    restored = await restoreBackupMediaPaths(
      archived,
      '/stage',
      '/new device/media',
    );
  expect(restored.media).toBeUndefined();
  expect(entry(restored)[0]).toMatchObject({
    persistedCoverUrl: `file:///new%20device/media/covers/${digest}.cover`,
    customCoverUrl: 'https://custom/image',
    coverUrl: 'https://source/image',
    customIntro: 'private',
    intro: 'source',
    progress: 0.35,
  });
  expect(entry(restored, 'reader.preferences.v1').paperBackgroundImage).toMatch(
    /^file:\/\/\/new%20device\/media\/bg\/.*reading%20paper.png$/,
  );
  expect(entry(restored, 'bookshelf.groups.v1')[0].cover).toBe(
    'file:///new%20device/media/covers/other.jpg',
  );
  expect(restored.entries.unrelated).toEqual(archived.entries.unrelated);
});
test.each(['missing', 'changed', 'size'])(
  'rejects %s archive media before activation',
  async failure => {
    const archived = await prepareBackupMedia(
        snapshot(),
        '/stage',
        defaultBackupPreferences,
      ),
      file = archived.media!.files[0];
    if (failure === 'missing') mockFiles.delete('/stage/' + file.path);
    else if (failure === 'changed')
      mockFiles.set('/stage/' + file.path, 'xxxx');
    else file.size++;
    await expect(
      restoreBackupMediaPaths(archived, '/stage', '/new'),
    ).rejects.toThrow(/缺失|校验失败/);
  },
);
test('old archives clear unavailable native cover paths and keep existing or network candidates', async () => {
  const original = snapshot();
  original.entries['library.v1'] = {
    type: 'string',
    value: JSON.stringify([
      {
        persistedCoverUrl: '/old/covers/missing.cover',
        customCoverUrl: '/docs/covers/other.jpg',
        coverUrl: 'https://source/image',
      },
    ]),
  };
  expect(
    entry(await restoreBackupMediaPaths(original, '/stage', '/new'))[0],
  ).toEqual({
    customCoverUrl: '/docs/covers/other.jpg',
    coverUrl: 'https://source/image',
  });
});
test('omitting persistent covers strips only that layer', () => {
  expect(
    entry(mapBackupMedia(snapshot(), value => value, false))[0],
  ).toMatchObject({
    customCoverUrl: 'https://custom/image',
    coverUrl: 'https://source/image',
    customIntro: 'private',
  });
  expect(
    entry(mapBackupMedia(snapshot(), value => value, false))[0]
      .persistedCoverUrl,
  ).toBeUndefined();
});
test.each([
  '../escape',
  'covers/../escape',
  'covers//a',
  'covers/./a',
  'bg/a\\b',
  '/covers/a',
])('rejects invalid media path %s', path => {
  const media: BackupMediaIndex = {
    version: 1,
    references: { '/old/a': path },
    files: [{ path, sha256: 'a'.repeat(64), size: 1 }],
  };
  expect(() => validateBackupMedia(media)).toThrow('媒体');
});
test('rejects duplicate files and references outside the declared file set', () => {
  const file = { path: 'covers/a', sha256: 'a'.repeat(64), size: 1 };
  expect(() =>
    validateBackupMedia({ version: 1, references: {}, files: [file, file] }),
  ).toThrow('媒体');
  expect(() =>
    validateBackupMedia({
      version: 1,
      references: { '/old/a': 'covers/missing' },
      files: [file],
    }),
  ).toThrow('媒体');
});

test('background references outside app-owned documents do not add unrelated files', async () => {
  mockPut('/outside/private.png', 'private');
  const value = snapshot();
  value.entries['reader.preferences.v1'] = {
    type: 'string',
    value: JSON.stringify({
      paperBackgroundImage: '/outside/private.png',
      nightBackgroundImage: '/docs/../outside/private.png',
    }),
  };
  const archived = await prepareBackupMedia(
    value,
    '/stage',
    defaultBackupPreferences,
  );
  expect(
    archived.media?.files.every(file => !file.path.startsWith('bg/')),
  ).toBe(true);
});
