import {
  onlineBookId,
  switchLibraryBookSource,
  toLibraryBook,
  mergeOnlineBookIntoShelf,
} from '../src/core/onlineLibrary';
import type { BookChapter, SearchBook } from '../src/types';

const book: SearchBook = {
  bookUrl: 'https://example.com/book/1',
  origin: 'https://example.com/source',
  originName: '示例源',
  name: '远程书籍',
  author: '作者',
  intro: '简介',
  tocUrl: 'https://example.com/book/1/toc',
};
const chapters: BookChapter[] = [
  {
    url: 'https://example.com/book/1/1',
    title: '第一章',
    index: 0,
    bookUrl: book.bookUrl,
    baseUrl: book.tocUrl!,
    isVolume: false,
    isVip: false,
    isPay: false,
  },
];

test('creates a stable source-scoped library id', () => {
  expect(onlineBookId(book)).toBe(onlineBookId({ ...book, name: '改名' }));
});

test('preserves remote chapter metadata for lazy content loading', () => {
  const result = toLibraryBook(book, chapters);
  expect(result.origin).toBe(book.origin);
  expect(result.bookUrl).toBe(book.bookUrl);
  expect(result.chapters?.[0]).toMatchObject({
    title: '第一章',
    content: '',
    url: chapters[0].url,
    baseUrl: chapters[0].baseUrl,
  });
});

test('adding the same online book again preserves progress, annotations and shelf order', () => {
  const original = {
    ...toLibraryBook(book, chapters), currentChapterIndex: 3, progress: 0.5,
    chapterTitle: '已读章节', readingPosition: { chapterId: 'saved', position: 432 },
    groupIds: ['favorite'], customIntro: '个人简介', content: '已缓存正文',
  };
  const other = { ...original, id: 'other', name: '另一本' };
  const fresh = { ...toLibraryBook(book, chapters), intro: '新的简介', progress: 0 };
  const result = mergeOnlineBookIntoShelf([original, other], fresh);
  expect(result).toEqual([original, other]);
  expect(result[0]).toMatchObject({
    currentChapterIndex: 3, progress: 0.5, readingPosition: { chapterId: 'saved', position: 432 },
    groupIds: ['favorite'], customIntro: '个人简介', content: '已缓存正文',
  });
});

test('restores an unshelved online book without discarding its prior reading data', () => {
  const old = { ...toLibraryBook(book, chapters), notShelf: true, nativeType: 8 | 1024, progress: 0.4 };
  const result = mergeOnlineBookIntoShelf([old], toLibraryBook(book, chapters));
  expect(result[0]).toMatchObject({ notShelf: false, nativeType: 8, progress: 0.4 });
});

test('appends new books and replaces a local book with a matching id', () => {
  const online = toLibraryBook(book, chapters);
  const local = { ...online, localUri: 'file:///book.txt', progress: 0.7 };
  expect(mergeOnlineBookIntoShelf([], online)).toEqual([online]);
  expect(mergeOnlineBookIntoShelf([local], online)).toEqual([online]);
});

test('switches source while preserving identity, groups and matching progress', () => {
  const current = {
    ...toLibraryBook(book, [
      chapters[0],
      { ...chapters[0], url: 'old-2', title: '第二章', index: 1 },
    ]),
    id: 'stable-book-id',
    groupIds: ['favorite'],
    chapterTitle: '第二章',
    currentChapterIndex: 1,
    progress: 0.5,
    keepDuplicateTitleKeys: ['00001-1234567890abcdef.nr'],
  };
  const switched = switchLibraryBookSource(
    current,
    { ...book, origin: 'https://new.example', bookUrl: '/new-book' },
    [
      { ...chapters[0], url: 'new-1' },
      { ...chapters[0], url: 'new-2', title: '第二章', index: 1 },
    ],
  );
  expect(switched).toMatchObject({
    id: 'stable-book-id',
    groupIds: ['favorite'],
    origin: 'https://new.example',
    currentChapterIndex: 1,
    chapterTitle: '第二章',
    progress: 0.5,
    keepDuplicateTitleKeys: ['00001-1234567890abcdef.nr'],
  });
});

test('moves the native character position to the matched chapter when switching source', () => {
  const current = {
    ...toLibraryBook(book, [chapters[0], { ...chapters[0], url: 'old-2', title: '第二章', index: 1 }]),
    chapterTitle: '第二章', currentChapterIndex: 1,
    readingPosition: { chapterId: 'old-2', position: 376, titleVisible: false },
  };
  const switched = switchLibraryBookSource(current,
    { ...book, origin: 'https://new.example', bookUrl: '/new-book' },
    [{ ...chapters[0], url: 'new-1' }, { ...chapters[0], url: 'new-2', title: '第二章', index: 1 }]);
  expect(switched.currentChapterIndex).toBe(1);
  expect(switched.readingPosition).toEqual({ chapterId: 'new-2', position: 376, titleVisible: false });
});

test('does not apply a stale position belonging to a different chapter during source switch', () => {
  const current = {
    ...toLibraryBook(book, [chapters[0], { ...chapters[0], url: 'old-2', title: '第二章', index: 1 }]),
    chapterTitle: '第二章', currentChapterIndex: 1,
    readingPosition: { chapterId: chapters[0].url, position: 376 },
  };
  const switched = switchLibraryBookSource(current,
    { ...book, origin: 'https://new.example', bookUrl: '/new-book' },
    [{ ...chapters[0], url: 'new-1' }, { ...chapters[0], url: 'new-2', title: '第二章', index: 1 }]);
  expect(switched.readingPosition).toBeUndefined();
});

test('matches the current chapter when source titles only differ in spacing and punctuation', () => {
  const current = {
    ...toLibraryBook(book, chapters),
    chapterTitle: '第 1 章：初入',
    progress: 0.9,
  };
  const switched = switchLibraryBookSource(
    current,
    { ...book, origin: 'https://new.example', bookUrl: '/new-book' },
    [
      { ...chapters[0], url: 'new-1', title: '第1章 初入', index: 0 },
      { ...chapters[0], url: 'new-2', title: '第2章 继续', index: 1 },
    ],
  );
  expect(switched).toMatchObject({
    currentChapterIndex: 0,
    chapterTitle: '第1章 初入',
  });
});

test('copies source metadata and native source type when adding a searched book', () => {
  const result = toLibraryBook(
    {
      ...book,
      kind: '玄幻,经典',
      wordCount: '1.2万字',
      latestChapterTitle: '最终章',
      coverUrl: 'https://example.com/cover.jpg',
      sourceType: 3,
    },
    chapters,
  );
  expect(result).toMatchObject({
    kind: '玄幻,经典',
    wordCount: '1.2万字',
    latestChapterTitle: '最终章',
    coverUrl: 'https://example.com/cover.jpg',
    sourceType: 3,
    nativeType: 136,
  });
});

test.each([
  [0, 8],
  [1, 32],
  [2, 64],
  [3, 136],
  [4, 4],
  [999, 8],
])('maps source type %i to native book flags %i', (sourceType, nativeType) => {
  expect(toLibraryBook({ ...book, sourceType }, chapters).nativeType).toBe(
    nativeType,
  );
});
