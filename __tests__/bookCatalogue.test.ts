import {
  applyBookCatalogue,
  fetchBookCatalogue,
  needsBookCatalogue,
} from '../src/core/bookCatalogue';
import type { Book, BookChapter, BookSource, SearchBook } from '../src/types';
const book: Book = {
  id: 'book',
  name: 'Name',
  author: 'Author',
  intro: 'Old intro',
  origin: 'source',
  bookUrl: 'https://example.com/book',
  chapterTitle: '',
  content: '',
  chapters: [],
  progress: 0,
  updatedAt: 1,
  pendingCatalog: true,
};
const source: BookSource = {
  bookSourceUrl: 'source',
  bookSourceName: 'Source',
  customOrder: 0,
  enabled: true,
  enabledExplore: true,
  bookSourceType: 0,
};
const info: SearchBook = {
  name: 'Name',
  author: 'Author',
  intro: 'Full intro',
  origin: 'source',
  originName: 'Source',
  bookUrl: book.bookUrl!,
  tocUrl: 'https://example.com/toc',
};
const chapters: BookChapter[] = [
  {
    index: 0,
    url: '/volume',
    title: 'Volume',
    bookUrl: book.bookUrl!,
    baseUrl: info.tocUrl!,
    isVolume: true,
    isVip: false,
    isPay: false,
  },
  {
    index: 1,
    url: '/chapter',
    title: 'Chapter',
    bookUrl: book.bookUrl!,
    baseUrl: info.tocUrl!,
    isVolume: false,
    isVip: false,
    isPay: false,
  },
];
test('pending online books need a catalogue; local, file-download and cached inline books do not', () => {
  expect(needsBookCatalogue(book)).toBe(true);
  expect(needsBookCatalogue({ ...book, localUri: 'file:///book.txt' })).toBe(
    false,
  );
  expect(needsBookCatalogue({ ...book, origin: 'local' })).toBe(false);
  expect(needsBookCatalogue({ ...book, sourceType: 3 })).toBe(false);
  expect(
    needsBookCatalogue({
      ...book,
      pendingCatalog: false,
      content: 'Inline text',
    }),
  ).toBe(false);
});
test('info is loaded before the directory, and a known TOC skips the info request', async () => {
  const loadInfo = jest.fn(async () => info),
    loadToc = jest.fn(async () => chapters);
  await expect(
    fetchBookCatalogue(book, source, loadInfo, loadToc),
  ).resolves.toEqual({ info, chapters });
  expect(loadInfo).toHaveBeenCalledTimes(1);
  loadInfo.mockClear();
  await fetchBookCatalogue(
    { ...book, tocUrl: info.tocUrl },
    source,
    loadInfo,
    loadToc,
  );
  expect(loadInfo).not.toHaveBeenCalled();
});
test('empty catalogues fail and cancellation between steps prevents the next request', async () => {
  await expect(
    fetchBookCatalogue(
      book,
      source,
      async () => info,
      async () => [],
    ),
  ).rejects.toThrow('目录为空');
  let checked = 0;
  const loadToc = jest.fn(async () => chapters);
  await expect(
    fetchBookCatalogue(
      book,
      source,
      async () => info,
      loadToc,
      () => {
        if (++checked > 1) throw new Error('Cancelled');
      },
    ),
  ).rejects.toThrow('Cancelled');
  expect(loadToc).not.toHaveBeenCalled();
});
test('hydration selects a readable chapter and preserves concurrent edits, progress and cached text', () => {
  const current = {
    ...book,
    name: 'User title',
    intro: 'User intro',
    groupIds: ['8'],
    progress: 0.25,
    chapters: [
      {
        id: '/chapter',
        url: '/chapter',
        title: 'Old chapter',
        content: 'Cached text',
      },
    ],
  };
  const ready = applyBookCatalogue(current, book, info, chapters);
  expect(ready).toMatchObject({
    id: book.id,
    name: 'User title',
    intro: 'User intro',
    groupIds: ['8'],
    progress: 0.25,
    currentChapterIndex: 1,
    chapterTitle: 'Chapter',
    content: 'Cached text',
    pendingCatalog: false,
    latestChapterTitle: 'Chapter',
  });
  expect(
    applyBookCatalogue(
      { ...current, origin: 'new-source' },
      book,
      info,
      chapters,
    ).origin,
  ).toBe('new-source');
});

test('hydrates a restored native cursor using the source chapter matcher and retains its UTF-16 position', () => {
  const pending = {
    ...book,
    pendingReadingPosition: {
      chapterIndex: 1,
      chapterTitle: 'Chapter',
      position: 128,
      totalChapters: 2,
      titleVisible: true,
    },
    customIntro: 'Private',
    groupIds: ['8'],
  };
  const ready = applyBookCatalogue(pending, pending, info, chapters);
  expect(ready.currentChapterIndex).toBe(1);
  expect(ready.readingPosition).toEqual({
    chapterId: '/chapter',
    position: 128,
    titleVisible: true,
  });
  expect(ready.pendingReadingPosition).toBeUndefined();
  expect(ready.customIntro).toBe('Private');
  expect(ready.groupIds).toEqual(['8']);
});
