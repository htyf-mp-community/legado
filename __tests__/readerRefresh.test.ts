jest.mock('../src/data/storage', () => ({
  appStorage: { getString: jest.fn(), set: jest.fn(), remove: jest.fn() },
}));

import {
  clearReaderChapterCache,
  refreshBookMetadata,
  refreshReaderChapter,
  refreshReaderToc,
} from '../src/core/readerRefresh';
import type { Book, BookChapter, BookSource } from '../src/types';

const source: BookSource = {
  bookSourceUrl: 'https://source.example',
  bookSourceName: 'Source',
  bookSourceType: 0,
  customOrder: 0,
  enabled: true,
  enabledExplore: true,
};
const book: Book = {
  id: 'library-id',
  name: 'Book',
  author: 'Author',
  intro: '',
  origin: source.bookSourceUrl,
  originName: source.bookSourceName,
  bookUrl: 'https://book.example',
  tocUrl: 'https://book.example/toc',
  chapterTitle: 'Chapter 2',
  content: 'cached two',
  currentChapterIndex: 1,
  progress: 0.5,
  updatedAt: 1,
  groupIds: ['favorite'],
  chapters: [
    { id: 'old-1', title: 'Chapter 1', url: 'one', content: 'cached one' },
    { id: 'old-2', title: 'Chapter 2', url: 'two', content: 'cached two' },
  ],
};

test('force-refreshes current content without discarding other chapters', async () => {
  const load = jest.fn(async () => 'fresh two');
  const refreshed = await refreshReaderChapter(book, 1, source, load);
  expect(refreshed).toMatchObject({
    id: 'library-id',
    content: 'fresh two',
    currentChapterIndex: 1,
    groupIds: ['favorite'],
  });
  expect(refreshed.chapters?.map(item => item.content)).toEqual([
    'cached one',
    'fresh two',
  ]);
  expect(load).toHaveBeenCalledWith(
    source,
    expect.objectContaining({ url: 'two', index: 1 }),
  );
});

test('updates the directory while preserving the native chapter index and position', async () => {
  const incoming: BookChapter[] = [
    {
      url: 'zero',
      title: 'Prologue',
      index: 0,
      bookUrl: book.bookUrl!,
      baseUrl: '',
      isVolume: false,
      isVip: false,
      isPay: false,
    },
    {
      url: 'one',
      title: 'Chapter 1',
      index: 1,
      bookUrl: book.bookUrl!,
      baseUrl: '',
      isVolume: false,
      isVip: false,
      isPay: false,
    },
    {
      url: 'two-new',
      title: 'Chapter 2',
      index: 2,
      bookUrl: book.bookUrl!,
      baseUrl: '',
      isVolume: false,
      isVip: false,
      isPay: false,
    },
  ];
  const current = { ...book, readingPosition: { chapterId: 'old-2', position: 120, titleVisible: false } };
  const refreshed = await refreshReaderToc(current, source, async () => incoming);
  expect(refreshed).toMatchObject({
    id: 'library-id',
    currentChapterIndex: 1,
    chapterTitle: 'Chapter 1',
    content: 'cached one',
    readingPosition: { chapterId: refreshed.chapters?.[1].id, position: 120, titleVisible: false },
    groupIds: ['favorite'],
  });
  expect(refreshed.chapters?.map(item => item.content)).toEqual([
    '',
    'cached one',
    'cached two',
  ]);
});

test('rejects an empty refreshed directory without changing the book', async () => {
  await expect(refreshReaderToc(book, source, async () => [])).rejects.toThrow(
    'empty chapter directory',
  );
});

test('clamps a shortened directory and maps the current character position to its last chapter', async () => {
  const current = { ...book, readingPosition: { chapterId: 'old-2', position: 33 } };
  const incoming: BookChapter[] = [{
    url: 'one', title: 'Chapter 1', index: 0, bookUrl: book.bookUrl!, baseUrl: '',
    isVolume: false, isVip: false, isPay: false,
  }];
  const refreshed = await refreshReaderToc(current, source, async () => incoming);
  expect(refreshed.currentChapterIndex).toBe(0);
  expect(refreshed.readingPosition).toEqual({ chapterId: refreshed.chapters?.[0].id, position: 33 });
});

test('rebases a delayed directory update onto the newest chapter, cursor and cached content', async () => {
  let finish!: (chapters: BookChapter[]) => void;
  const pending = new Promise<BookChapter[]>(resolve => { finish = resolve; });
  let latest: Book = { ...book, currentChapterIndex: 0, chapterTitle: 'Chapter 1',
    readingPosition: { chapterId: 'old-1', position: 8 } };
  const task = refreshReaderToc(latest, source, async () => pending, () => latest);
  latest = { ...latest, currentChapterIndex: 1, chapterTitle: 'Chapter 2',
    readingPosition: { chapterId: 'old-2', position: 55, titleVisible: false },
    chapters: latest.chapters!.map((item, i) => i === 1 ? { ...item, content: 'newly loaded' } : item) };
  finish([
    { url: 'one', title: 'Chapter 1', index: 0, bookUrl: book.bookUrl!, baseUrl: '', isVolume: false, isVip: false, isPay: false },
    { url: 'two', title: 'Chapter 2', index: 1, bookUrl: book.bookUrl!, baseUrl: '', isVolume: false, isVip: false, isPay: false },
  ]);
  const result = await task;
  expect(result).toMatchObject({ currentChapterIndex: 1, chapterTitle: 'Chapter 2', content: 'newly loaded',
    readingPosition: { chapterId: 'old-2', position: 55, titleVisible: false } });
});

test.each(['origin', 'bookUrl', 'tocUrl', 'reverseToc', 'sourceType'] as const)(
  'rejects a delayed directory update after %s changes', async key => {
    let finish!: (chapters: BookChapter[]) => void;
    const pending = new Promise<BookChapter[]>(resolve => { finish = resolve; });
    const task = refreshReaderToc(book, source, async () => pending,
      () => ({ ...book, [key]: key === 'reverseToc' ? true : key === 'sourceType' ? 2 : 'changed' }));
    finish([{ url: 'one', title: 'Chapter 1', index: 0, bookUrl: book.bookUrl!, baseUrl: '', isVolume: false, isVip: false, isPay: false }]);
    await expect(task).rejects.toMatchObject({ name: 'StaleReaderTocError' });
  },
);

test('discards an old network failure after the book has switched source', async () => {
  let fail!: (reason: Error) => void;
  const pending = new Promise<BookChapter[]>((_resolve, reject) => { fail = reject; });
  const task = refreshReaderToc(book, source, async () => pending, () => ({ ...book, origin: 'new-source' }));
  fail(new Error('old source failed'));
  await expect(task).rejects.toMatchObject({ name: 'StaleReaderTocError' });
});

test('clears only the requested chapter-cache range', () => {
  const after = clearReaderChapterCache(book, 1, 'after');
  expect(after.chapters?.map(item => item.content)).toEqual(['cached one', '']);
  expect(after).toMatchObject({
    content: '',
    currentChapterIndex: 1,
    chapterTitle: 'Chapter 2',
  });
  expect(
    clearReaderChapterCache(book, 1, 'all').chapters?.map(item => item.content),
  ).toEqual(['', '']);
});

test('refreshes book metadata and catalogue without losing library identity', async () => {
  const refreshed = await refreshBookMetadata(
    book,
    source,
    async () => ({
      bookUrl: book.bookUrl!,
      origin: source.bookSourceUrl,
      originName: source.bookSourceName,
      name: 'New name',
      author: 'New author',
      intro: 'New intro',
      coverUrl: undefined,
      tocUrl: 'https://book.example/new-toc',
      latestChapterTitle: undefined,
    }),
    async () => [
      {
        url: 'two',
        title: 'Chapter 2',
        index: 0,
        bookUrl: book.bookUrl!,
        baseUrl: '',
        isVolume: false,
        isVip: false,
        isPay: false,
      },
    ],
  );
  expect(refreshed).toMatchObject({
    id: 'library-id',
    name: 'New name',
    author: 'New author',
    intro: 'New intro',
    tocUrl: 'https://book.example/new-toc',
    groupIds: ['favorite'],
    content: 'cached two',
  });
});
