import type { Book } from '../src/types';
const mockFiles = new Map<string, string>();
let mockBooks: Book[] = [],
  mockBeforeDownload: (() => Promise<void>) | undefined,
  mockDuringDecode: (() => void) | undefined,
  mockWifi = true,
  mockJob = 0;
const mockAbort = new Map<number, (cause: Error) => void>();
jest.mock('../src/data/library', () => ({
  getLibrarySnapshot: () => ({ books: mockBooks }),
  loadLibrary: async () => mockBooks,
  updateLibrary: async (change: (books: Book[]) => Book[]) => {
    mockBooks = change(mockBooks);
    return mockBooks;
  },
}));
jest.mock('../src/data/sources', () => ({ loadSources: async () => [] }));
jest.mock('../src/data/coverPreferences', () => ({
  loadCoverPreferences: () => ({ loadOnlyWifi: !mockWifi }),
}));
jest.mock('../src/data/appLog', () => ({ addAppLog: jest.fn() }));
jest.mock('../src/core/bookCoverRequest', () => ({
  buildBookCoverRequest: (uri: string) => ({
    uri,
    headers: { 'X-Test': 'cover' },
  }),
}));
jest.mock('@react-native-community/netinfo', () => ({
  fetch: async () => ({ type: mockWifi ? 'wifi' : 'cellular' }),
}));
jest.mock('react-native', () => ({
  Image: {
    getSize: jest.fn(
      (
        uri: string,
        done: (width: number, height: number) => void,
        fail: (cause: Error) => void,
      ) => {
        mockDuringDecode?.();
        if (mockFiles.get(decodeURIComponent(uri.slice(7))) === 'not-an-image')
          fail(new Error('decode failed'));
        else done(100, 120);
      },
    ),
  },
}));
jest.mock('@dr.pogodin/react-native-fs', () => ({
  DocumentDirectoryPath: '/docs',
  CachesDirectoryPath: '/cache',
  mkdir: jest.fn(async () => undefined),
  exists: async (path: string) => mockFiles.has(path),
  stat: async (path: string) => {
    if (!mockFiles.has(path)) throw new Error('missing');
    return { isFile: () => true, size: mockFiles.get(path)!.length };
  },
  hash: async (path: string) =>
    jest
      .requireActual('crypto')
      .createHash('md5')
      .update(mockFiles.get(path))
      .digest('hex'),
  copyFile: jest.fn(async (from: string, to: string) => {
    mockFiles.set(to, mockFiles.get(from)!);
  }),
  moveFile: jest.fn(async (from: string, to: string) => {
    mockFiles.set(to, mockFiles.get(from)!);
    mockFiles.delete(from);
  }),
  unlink: jest.fn(async (path: string) => {
    mockFiles.delete(path);
  }),
  stopDownload: jest.fn((id: number) =>
    mockAbort.get(id)?.(new Error('download stopped')),
  ),
  downloadFile: jest.fn((options: { fromUrl: string; toFile: string }) => {
    const id = ++mockJob;
    mockFiles.set(options.toFile, '');
    const aborted = new Promise<never>((_, reject) =>
      mockAbort.set(id, reject),
    );
    const downloaded = (async () => {
      await mockBeforeDownload?.();
      mockFiles.set(
        options.toFile,
        options.fromUrl.includes('invalid') ? 'not-an-image' : 'image-bytes',
      );
      return { statusCode: options.fromUrl.includes('404') ? 404 : 200 };
    })();
    return { jobId: id, promise: Promise.race([downloaded, aborted]) };
  }),
}));
import {
  copyFile,
  downloadFile,
  stopDownload,
} from '@dr.pogodin/react-native-fs';
import { Image } from 'react-native';
import {
  installPersistentCover,
  startManagedCoverOperation,
} from '../src/services/bookCoverPersistence';
const book: Book = {
  id: 'b',
  name: 'Book',
  author: 'A',
  intro: '',
  chapterTitle: 'one',
  content: 'text',
  progress: 0.6,
  updatedAt: 1,
  origin: 'source',
  bookUrl: '/book',
  coverUrl: 'https://source/a.jpg',
  groupIds: ['1'],
};
beforeEach(() => {
  jest.clearAllMocks();
  mockBooks = [{ ...book }];
  mockFiles.clear();
  mockAbort.clear();
  mockBeforeDownload = undefined;
  mockDuringDecode = undefined;
  mockWifi = true;
});
const run = (kind: 'persist' | 'network' | 'source', ids = ['b']) =>
  startManagedCoverOperation(kind, new Set(ids)).promise;
test('downloads and decodes before content-addressed install, preserving concurrent reading metadata', async () => {
  mockDuringDecode = () => {
    expect(mockBooks[0].persistedCoverUrl).toBeUndefined();
    mockBooks[0] = { ...mockBooks[0], progress: 0.9, groupIds: ['2'] };
  };
  expect(await run('persist')).toEqual({ saved: 1, skipped: 0, failed: 0 });
  expect(mockBooks[0]).toMatchObject({
    coverUrl: book.coverUrl,
    progress: 0.9,
    groupIds: ['2'],
    content: 'text',
    persistedCoverUrl: expect.stringMatching(
      /^\/docs\/covers\/[a-f0-9]{32}\.cover$/,
    ),
  });
  expect(Image.getSize).toHaveBeenCalled();
  expect([...mockFiles.keys()]).toEqual([mockBooks[0].persistedCoverUrl]);
  mockDuringDecode = undefined;
  expect(await run('persist')).toEqual({ saved: 1, skipped: 0, failed: 0 });
  expect(copyFile).toHaveBeenCalledTimes(1);
});
test.each(['origin', 'coverUrl', 'customCoverUrl', 'persistedCoverUrl'])(
  'a concurrent %s change discards the downloaded result',
  async key => {
    mockDuringDecode = () => {
      mockBooks[0] = { ...mockBooks[0], [key]: 'new' };
    };
    expect(await run('persist')).toEqual({ saved: 0, skipped: 1, failed: 0 });
    expect(mockBooks[0][key as keyof Book]).toBe('new');
    if (key !== 'persistedCoverUrl')
      expect(mockBooks[0].persistedCoverUrl).toBeUndefined();
  },
);
test('a removed book is not recreated, and missing/local cover candidates are skipped', async () => {
  mockBooks.push({ ...book, id: 'local', customCoverUrl: '/local.jpg' });
  mockDuringDecode = () => {
    mockBooks = mockBooks.filter(value => value.id !== 'b');
  };
  expect(await run('persist', ['missing', 'local', 'b'])).toEqual({
    saved: 0,
    skipped: 3,
    failed: 0,
  });
  expect(mockBooks.map(value => value.id)).toEqual(['local']);
});
test('bad HTTP/image bytes and Wi-Fi restrictions never install or update a cover', async () => {
  mockBooks = ['404', 'invalid'].map(id => ({
    ...book,
    id,
    coverUrl: `https://source/${id}`,
  }));
  expect(await run('persist', ['404', 'invalid'])).toEqual({
    saved: 0,
    skipped: 0,
    failed: 2,
  });
  expect(copyFile).not.toHaveBeenCalled();
  expect(mockFiles.size).toBe(0);
  mockWifi = false;
  mockBooks = [book];
  expect(await run('persist')).toEqual({ saved: 0, skipped: 0, failed: 1 });
  expect(downloadFile).toHaveBeenCalledTimes(2);
});
test('restore levels preserve source and custom layers independently and leave shared stored files intact', async () => {
  mockBooks = [
    {
      ...book,
      customCoverUrl: 'https://custom/a',
      persistedCoverUrl: '/docs/covers/shared.cover',
    },
  ];
  mockFiles.set('/docs/covers/shared.cover', 'image');
  expect((await run('network')).saved).toBe(1);
  expect(mockBooks[0]).toMatchObject({
    coverUrl: book.coverUrl,
    customCoverUrl: 'https://custom/a',
    persistedCoverUrl: undefined,
  });
  expect((await run('source')).saved).toBe(1);
  expect(mockBooks[0]).toMatchObject({
    coverUrl: book.coverUrl,
    customCoverUrl: undefined,
    persistedCoverUrl: undefined,
  });
  expect(mockFiles.get('/docs/covers/shared.cover')).toBe('image');
});
test('a restore cancels and waits for an active download before clearing the old layer', async () => {
  mockBooks[0] = { ...book, persistedCoverUrl: '/old.cover' };
  let started!: () => void;
  const ready = new Promise<void>(resolve => {
    started = resolve;
  });
  mockBeforeDownload = () => {
    started();
    return new Promise<void>(() => undefined);
  };
  const old = startManagedCoverOperation('persist', new Set(['b']));
  const oldResult = expect(old.promise).rejects.toMatchObject({
    name: 'AbortError',
  });
  await ready;
  const restored = run('network');
  await oldResult;
  expect((await restored).saved).toBe(1);
  expect(stopDownload).toHaveBeenCalledTimes(1);
  expect(mockBooks[0].persistedCoverUrl).toBeUndefined();
  expect(mockFiles.size).toBe(0);
});
test('installer rejects empty input and cleans a failed partial copy', async () => {
  mockFiles.set('/empty', '');
  await expect(installPersistentCover('/empty')).rejects.toThrow('empty');
  mockFiles.set('/image', 'bytes');
  jest.mocked(copyFile).mockImplementationOnce(async (_from, to) => {
    mockFiles.set(to, 'partial');
    throw new Error('disk full');
  });
  await expect(installPersistentCover('/image')).rejects.toThrow('disk full');
  expect([...mockFiles.keys()]).toEqual(['/empty', '/image']);
});
test('cancelling during native image decode releases the queue even when its callback never arrives', async () => {
  let started!: () => void;
  const ready = new Promise<void>(resolve => {
    started = resolve;
  });
  jest.mocked(Image.getSize).mockImplementationOnce(() => {
    started();
  });
  const job = startManagedCoverOperation('persist', new Set(['b']));
  const result = expect(job.promise).rejects.toMatchObject({
    name: 'AbortError',
  });
  await ready;
  job.cancel();
  await result;
  expect(mockFiles.size).toBe(0);
  expect(mockBooks[0].persistedCoverUrl).toBeUndefined();
  expect((await run('source')).saved).toBe(0);
});
test('a selected book whose URL changes before dispatch is skipped instead of targeting its replacement source', async () => {
  const job = startManagedCoverOperation('persist', new Set(['b']));
  mockBooks = [{ ...book, origin: 'new', bookUrl: '/new' }];
  expect(await job.promise).toEqual({ saved: 0, skipped: 1, failed: 0 });
  expect(downloadFile).not.toHaveBeenCalled();
});
