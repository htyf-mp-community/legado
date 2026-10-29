jest.mock('@dr.pogodin/react-native-fs', () => ({
  unlink: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/core/mangaCache', () => ({
  clearMangaCache: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/core/epubBook', () => ({
  cleanupEpubAssets: jest.fn().mockResolvedValue(true),
}));
jest.mock('../src/data/library', () => ({
  loadLibrary: jest.fn(),
  updateLibrary: jest.fn(),
}));
jest.mock('../src/data/appLog', () => ({ addAppLog: jest.fn() }));
jest.mock('../src/data/sources', () => ({ loadSources: jest.fn() }));
jest.mock('../src/data/generalPreferences', () => ({
  loadGeneralPreferences: () => ({ threadCount: 2 }),
}));
jest.mock('../src/core/webBook', () => ({
  loadBookInfo: jest.fn(),
  loadChapters: jest.fn(),
}));
import { unlink } from '@dr.pogodin/react-native-fs';
import { clearMangaCache } from '../src/core/mangaCache';
import { cleanupEpubAssets } from '../src/core/epubBook';
import { loadLibrary, updateLibrary } from '../src/data/library';
import { loadSources } from '../src/data/sources';
import { loadBookInfo, loadChapters } from '../src/core/webBook';
import {
  clearManagedBookCache,
  deleteManagedBooks,
  refreshManagedBooks,
} from '../src/services/bookshelfManagement';
import { getBookshelfRefreshSnapshot } from '../src/services/bookshelfRefreshRuntime';
import type { Book } from '../src/types';
const make = (id: string, patch: Partial<Book> = {}): Book => ({
  id,
  name: id,
  author: 'A',
  intro: '',
  origin: 'source',
  bookUrl: `https://source/${id}`,
  tocUrl: 'https://source/toc',
  chapterTitle: 'One',
  chapters: [{ id: 'one', url: '/one', title: 'One', content: 'Body' }],
  content: 'Body',
  currentChapterIndex: 0,
  progress: 0.4,
  updatedAt: 1,
  ...patch,
});
let stored: Book[];
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(clearMangaCache).mockResolvedValue(undefined);
  stored = [
    make('a'),
    make('local', { origin: 'local', localUri: 'file:///books/My%20Book.txt' }),
  ];
  jest.mocked(loadLibrary).mockImplementation(async () => stored);
  jest.mocked(updateLibrary).mockImplementation(async transform => {
    stored = transform(stored);
    return stored;
  });
  jest.mocked(loadSources).mockResolvedValue([
    {
      bookSourceUrl: 'source',
      bookSourceName: 'S',
      customOrder: 0,
      enabled: true,
      enabledExplore: false,
      bookSourceType: 0,
    },
  ]);
});
test('cache clearing acts on selected caches and preserves concurrent progress and original local text', async () => {
  jest.mocked(clearMangaCache).mockImplementation(async () => {
    stored = stored.map(book => ({ ...book, progress: 0.8 }));
  });
  await clearManagedBookCache(new Set(['a', 'local']));
  expect(stored[0]).toMatchObject({ content: '', progress: 0.8 });
  expect(stored[1]).toMatchObject({ content: 'Body', progress: 0.8 });
  expect(unlink).not.toHaveBeenCalled();
});
test('removing from shelf preserves original file unless requested; opted-in original URI is decoded', async () => {
  await deleteManagedBooks(new Set(['local']), false);
  expect(stored.map(book => book.id)).toEqual(['a']);
  expect(cleanupEpubAssets).toHaveBeenCalled();
  expect(unlink).not.toHaveBeenCalled();
  stored.push(
    make('local', { origin: 'local', localUri: 'file:///books/My%20Book.txt' }),
  );
  await deleteManagedBooks(new Set(['local']), true);
  expect(unlink).toHaveBeenCalledWith('/books/My Book.txt');
});
test('batch information/catalogue refresh preserves current edits, skips local/disabled books and clears runtime tracking', async () => {
  stored.push(make('disabled', { canUpdate: false }));
  jest.mocked(loadBookInfo).mockImplementation(async (_source, value) => {
    stored = stored.map(book =>
      book.id === 'a'
        ? { ...book, progress: 0.7, customIntro: 'My intro', groupIds: ['1'] }
        : book,
    );
    return {
      ...value,
      name: 'Source rename',
      author: 'Source author',
      intro: 'New intro',
      coverUrl: value.coverUrl,
      latestChapterTitle: value.latestChapterTitle,
      tocUrl: value.tocUrl ?? 'https://source/toc',
    };
  });
  jest.mocked(loadChapters).mockResolvedValue([
    {
      index: 0,
      title: 'One',
      url: '/one',
      bookUrl: 'https://source/a',
      baseUrl: 'https://source/toc',
      isVolume: false,
      isVip: false,
      isPay: false,
    },
    {
      index: 1,
      title: 'Two',
      url: '/two',
      bookUrl: 'https://source/a',
      baseUrl: 'https://source/toc',
      isVolume: false,
      isVip: false,
      isPay: false,
    },
  ]);
  await refreshManagedBooks(new Set(['a', 'local', 'disabled']));
  expect(loadBookInfo).toHaveBeenCalledTimes(1);
  expect(stored[0]).toMatchObject({
    name: 'a',
    author: 'A',
    intro: 'New intro',
    customIntro: 'My intro',
    groupIds: ['1'],
    progress: 0.7,
    lastCheckCount: 1,
    updateError: false,
  });
  expect(stored[0].chapters?.[0].content).toBe('Body');
  expect(getBookshelfRefreshSnapshot().pending).toBe(0);
});
test('a source changed during a failed refresh is not marked as failed by the previous source', async () => {
  jest.mocked(loadBookInfo).mockImplementation(async () => {
    stored[0] = { ...stored[0], origin: 'new', bookUrl: 'https://new/book' };
    throw new Error('Old source failed');
  });
  const result = await refreshManagedBooks(new Set(['a']));
  expect(result[0].status).toBe('rejected');
  expect(stored[0].updateError).toBeUndefined();
  expect(getBookshelfRefreshSnapshot().pending).toBe(0);
});
