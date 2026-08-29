import {
  onlineBookId,
  switchLibraryBookSource,
  toLibraryBook,
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

test('switches source while preserving identity, groups and matching progress', () => {
  const current = {
    ...toLibraryBook(book, [
      chapters[0],
      { ...chapters[0], url: 'old-2', title: '第二章', index: 1 },
    ]),
    id: 'stable-book-id',
    groupIds: ['favorite'],
    chapterTitle: '第二章',
    progress: 0.5,
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
  });
});
