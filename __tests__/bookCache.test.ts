import {
  cacheBookChapters,
  mergeRefreshedChapters,
} from '../src/core/bookCache';
import type { Book, BookChapter, SearchBook } from '../src/types';

const book: Book = {
  id: 'book',
  name: '书',
  author: '作者',
  intro: '',
  chapterTitle: '第二章',
  content: '旧二',
  chapters: [
    { id: 'one', title: '第一章', url: '/1', content: '已缓存一' },
    { id: 'two', title: '第二章', url: '/2', content: '旧二' },
  ],
  currentChapterIndex: 1,
  progress: 0.5,
  updatedAt: 1,
  origin: 'source',
  bookUrl: '/book',
};
const info: SearchBook = {
  name: '书（更新）',
  author: '作者',
  intro: '新简介',
  origin: 'source',
  originName: '源',
  bookUrl: '/book',
  tocUrl: '/toc',
};
const chapters: BookChapter[] = [
  {
    url: '/1',
    title: '第一章',
    index: 0,
    bookUrl: '/book',
    baseUrl: '/toc',
    isVolume: false,
    isVip: false,
    isPay: false,
  },
  {
    url: '/2',
    title: '第二章（改名）',
    index: 1,
    bookUrl: '/book',
    baseUrl: '/toc',
    isVolume: false,
    isVip: false,
    isPay: false,
  },
  {
    url: '/3',
    title: '第三章',
    index: 2,
    bookUrl: '/book',
    baseUrl: '/toc',
    isVolume: false,
    isVip: false,
    isPay: false,
  },
];

test('refreshes metadata and directory while preserving cached content by URL', () => {
  const refreshed = mergeRefreshedChapters(book, info, chapters);
  expect(refreshed.name).toBe('书（更新）');
  expect(refreshed.chapters).toHaveLength(3);
  expect(refreshed.chapters?.[0].content).toBe('已缓存一');
  expect(refreshed.currentChapterIndex).toBe(1);
  expect(refreshed.chapterTitle).toBe('第二章（改名）');
});

test('does not erase the old directory when refresh returns no chapters', () => {
  const refreshed = mergeRefreshedChapters(book, info, []);
  expect(refreshed.chapters).toEqual(book.chapters);
  expect(refreshed.name).toBe('书（更新）');
});

test('caches only missing chapters in range and isolates failures', async () => {
  const refreshed = mergeRefreshedChapters(book, info, chapters),
    progress: number[] = [],
    result = await cacheBookChapters(
      refreshed,
      async chapter => {
        if (chapter.url === '/3') throw new Error('network');
        return `正文:${chapter.url}`;
      },
      {
        fromIndex: 1,
        concurrency: 2,
        onProgress: value => progress.push(value.completed),
      },
    );
  expect(result.total).toBe(1);
  expect(result.failures).toMatchObject([
    { chapterTitle: '第三章', message: 'network' },
  ]);
  expect(result.book.chapters?.[0].content).toBe('已缓存一');
  expect(progress).toEqual([1]);
});

test('stops scheduling new chapters after cancellation', async () => {
  const empty = {
      ...book,
      chapters: chapters.map(chapter => ({
        id: chapter.url,
        title: chapter.title,
        url: chapter.url,
        content: '',
      })),
    },
    loaded: string[] = [];
  let stop = false;
  const result = await cacheBookChapters(
    empty,
    async chapter => {
      loaded.push(chapter.id);
      stop = true;
      return chapter.title;
    },
    { concurrency: 1, cancelled: () => stop },
  );
  expect(loaded).toHaveLength(1);
  expect(result.cancelled).toBe(true);
  expect(result.completed).toBe(1);
});
