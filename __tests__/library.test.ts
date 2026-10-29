jest.mock('../src/data/storage', () => ({
  appStorage: { getString: jest.fn(), set: jest.fn() },
}));
jest.mock('../src/data/appLog', () => ({ addAppLog: jest.fn() }));
import { appStorage } from '../src/data/storage';
import {
  LibraryReadError,
  loadLibrary,
  saveLibrary,
} from '../src/data/library';
import type { Book } from '../src/types';
import { sortShelfBooks } from '../src/core/bookshelfGroups';
const getString = jest.mocked(appStorage.getString);
beforeEach(() => jest.clearAllMocks());
test('a new installation has an empty shelf and does not persist fixtures', async () => {
  getString.mockReturnValue(undefined);
  await expect(loadLibrary()).resolves.toEqual([]);
  expect(appStorage.set).not.toHaveBeenCalled();
});
test.each(['not JSON', '{}', '[null]', '[{"name":"lost id"}]'])(
  'unreadable shelf %s is preserved for recovery',
  async raw => {
    getString.mockReturnValue(raw);
    await expect(loadLibrary()).rejects.toBeInstanceOf(LibraryReadError);
    expect(appStorage.set).not.toHaveBeenCalled();
  },
);
test('old single-chapter books retain content, identity, metadata and progress', async () => {
  const book: Book = {
    id: 'old',
    name: '原有书',
    author: '作者',
    intro: '',
    chapterTitle: '旧章',
    content: '原文',
    progress: 0.4,
    updatedAt: 23,
  };
  getString.mockReturnValue(JSON.stringify([book]));
  const result = await loadLibrary();
  expect(result[0]).toMatchObject(book);
  expect(result[0].chapters).toEqual([
    { id: 'old-legacy', title: '旧章', content: '原文' },
  ]);
  await saveLibrary(result);
  expect(appStorage.set).toHaveBeenCalledWith(
    'library.v1',
    JSON.stringify(result),
  );
});
test('restored content can be loaded after a failed read without restarting', async () => {
  getString.mockReturnValueOnce('{broken').mockReturnValueOnce('[]');
  await expect(loadLibrary()).rejects.toBeInstanceOf(LibraryReadError);
  await expect(loadLibrary()).resolves.toEqual([]);
});
test('a discovery-list book keeps an empty catalogue instead of gaining a synthetic unread chapter', async () => {
  getString.mockReturnValue(
    JSON.stringify([
      {
        id: 'pending',
        name: 'Pending',
        author: 'A',
        intro: '',
        chapterTitle: '',
        content: '',
        chapters: [],
        progress: 0,
        pendingCatalog: true,
      },
    ]),
  );
  const [book] = await loadLibrary();
  expect(book.chapters).toEqual([]);
  expect(book.currentChapterIndex).toBe(0);
  expect(book.content).toBe('');
});
test('legacy entries without author metadata remain usable with author sorting and covers', async () => {
  getString.mockReturnValue(
    JSON.stringify([
      { id: 'a', name: 'A', updatedAt: 1 },
      { id: 'b', name: 'B', author: null, updatedAt: 2 },
    ]),
  );
  const books = await loadLibrary();
  expect(books.every(book => book.author === '')).toBe(true);
  expect(sortShelfBooks(books, 5).map(book => book.id)).toEqual(['a', 'b']);
});
