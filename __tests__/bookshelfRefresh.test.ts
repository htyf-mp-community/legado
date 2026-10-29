jest.mock('../src/core/webBook', () => ({ loadChapters: jest.fn() }));
import {
  hasUnreadChapters,
  applyBookshelfRefresh,
  mergeRefreshedChapters,
  refreshBookshelf,
} from '../src/core/bookshelfRefresh';
import { loadChapters } from '../src/core/webBook';
import type { Book } from '../src/types';
import { getBookshelfRefreshSnapshot } from '../src/services/bookshelfRefreshRuntime';

const book: Book = {
  id: 'b',
  name: 'Book',
  author: 'A',
  intro: '',
  chapterTitle: 'One',
  content: 'cached',
  progress: 0,
  updatedAt: 1,
  currentChapterIndex: 0,
  chapters: [{ id: '1', url: '/1', title: 'One', content: 'cached' }],
};

test('detects books with unread chapters', () => {
  expect(hasUnreadChapters(book)).toBe(false);
  expect(
    hasUnreadChapters({
      ...book,
      chapters: [...book.chapters!, { id: '2', title: 'Two', content: '' }],
    }),
  ).toBe(true);
});

test('merges refreshed catalogues while preserving cached content and progress', () => {
  const next = mergeRefreshedChapters(book, [
    {
      url: '/1',
      title: 'One renamed',
      index: 0,
      bookUrl: '',
      baseUrl: '',
      isVolume: false,
      isVip: false,
      isPay: false,
    },
    {
      url: '/2',
      title: 'Two',
      index: 1,
      bookUrl: '',
      baseUrl: '',
      isVolume: false,
      isVip: false,
      isPay: false,
    },
  ]);
  expect(next.chapters).toHaveLength(2);
  expect(next.chapters?.[0].content).toBe('cached');
  expect(next.currentChapterIndex).toBe(0);
});

test('skips books whose per-book update switch is disabled', async () => {
  const result = await refreshBookshelf(
    [
      {
        ...book,
        origin: 'https://source.example',
        bookUrl: 'https://book.example',
        canUpdate: false,
      },
    ],
    [
      {
        bookSourceUrl: 'https://source.example',
        bookSourceName: 'Source',
        bookSourceType: 0,
        customOrder: 0,
        enabled: true,
        enabledExplore: true,
      },
    ],
    { concurrency: 2, onlyUpdateRead: false },
  );
  expect(result).toMatchObject({ attempted: 0, updated: 0, failed: 0 });
});

test('refresh results retain imports, deletions, metadata edits, cached content and chapter identity changed during fetch', () => {
  const before = [book, { ...book, id: 'deleted' }];
  const refreshed = [
    {
      ...book,
      chapters: [
        { id: 'front', title: 'Inserted', content: '' },
        ...book.chapters!,
        { id: 'two', url: '/2', title: 'Two', content: '' },
      ],
      latestChapterTime: 40,
    },
    { ...book, id: 'deleted' },
  ];
  const current = [
    {
      ...book,
      name: 'Renamed while loading',
      progress: 0.7,
      durChapterTime: 30,
      chapters: [{ ...book.chapters![0], content: 'newly cached' }],
    },
    { ...book, id: 'imported' },
  ];
  const result = applyBookshelfRefresh(current, before, refreshed);
  expect(result.map(item => item.id)).toEqual(['b', 'imported']);
  expect(result[0]).toMatchObject({
    name: 'Renamed while loading',
    progress: 0.7,
    durChapterTime: 30,
    currentChapterIndex: 1,
    content: 'newly cached',
    latestChapterTime: 40,
  });
  expect(result[1]).toBe(current[1]);
});
test('a failed refresh never rolls a newer catalogue back', () => {
  const current = [
    {
      ...book,
      chapters: [
        ...book.chapters!,
        { id: '2', title: 'Two', content: 'cached later' },
      ],
    },
  ];
  expect(
    applyBookshelfRefresh(current, [book], [{ ...book, updateError: true }])[0],
  ).toMatchObject({ chapters: current[0].chapters, updateError: true });
});
test('refresh applies the selected group and reports an empty catalogue as failure', async () => {
  jest.mocked(loadChapters).mockResolvedValue([]);
  const source = {
    bookSourceUrl: 'source',
    bookSourceName: 'S',
    bookSourceType: 0,
    customOrder: 0,
    enabled: true,
    enabledExplore: true,
  };
  const books = [
    { ...book, origin: 'source', bookUrl: 'book', groupIds: ['1'] },
    { ...book, id: 'other', origin: 'source', bookUrl: 'other' },
  ];
  const result = await refreshBookshelf(books, [source], {
    concurrency: 2,
    onlyUpdateRead: false,
    groupId: '1',
    groups: [
      { id: '1', name: 'One', order: 0, show: true, enableRefresh: true },
    ],
  });
  expect(result).toMatchObject({ attempted: 1, updated: 0, failed: 1 });
  expect(result.books[0].updateError).toBe(true);
  expect(result.books[1]).toBe(books[1]);
});

test('a source change made during refresh prevents an old catalogue from overwriting the new source', () => {
  const original = { ...book, origin: 'old', bookUrl: '/old' };
  const changed = { ...book, origin: 'new', bookUrl: '/new' };
  const incoming = {
    ...original,
    chapters: [{ id: 'wrong-source', title: 'Wrong source', content: 'Wrong' }],
  };
  expect(applyBookshelfRefresh([changed], [original], [incoming])).toEqual([
    changed,
  ]);
});

test('each finished book is committed before slower books complete, and refresh indicators clear on failures', async () => {
  const source = {
    bookSourceUrl: 'https://source.example',
    bookSourceName: 'Source',
    bookSourceType: 0,
    customOrder: 0,
    enabled: true,
    enabledExplore: true,
  };
  let releaseSlow: ((value: never[]) => void) | undefined;
  const slow = new Promise<never[]>(resolve => {
    releaseSlow = resolve;
  });
  jest
    .mocked(loadChapters)
    .mockImplementation((_source, value) =>
      value.name === 'Fast'
        ? Promise.resolve([
            {
              index: 0,
              url: '/1',
              title: 'Fast updated',
              bookUrl: '',
              baseUrl: '',
              isVolume: false,
              isVip: false,
              isPay: false,
            },
          ])
        : slow,
    );
  let finishedFast: (() => void) | undefined;
  const firstCommitted = new Promise<void>(resolve => {
    finishedFast = resolve;
  });
  const committed: string[] = [];
  const task = refreshBookshelf(
    [
      {
        ...book,
        id: 'fast',
        name: 'Fast',
        origin: source.bookSourceUrl,
        bookUrl: '/fast',
      },
      {
        ...book,
        id: 'slow',
        name: 'Slow',
        origin: source.bookSourceUrl,
        bookUrl: '/slow',
      },
    ],
    [source],
    {
      concurrency: 2,
      onlyUpdateRead: false,
      onBookUpdated: (_old, next) => {
        committed.push(next.id);
        if (next.id === 'fast') finishedFast?.();
      },
    },
  );
  expect(getBookshelfRefreshSnapshot().pending).toBe(2);
  await firstCommitted;
  expect(committed).toEqual(['fast']);
  expect(getBookshelfRefreshSnapshot().running.has('slow')).toBe(true);
  releaseSlow?.([]);
  await expect(task).resolves.toMatchObject({ updated: 1, failed: 1 });
  expect(committed).toEqual(['fast', 'slow']);
  expect(getBookshelfRefreshSnapshot().pending).toBe(0);
  expect(getBookshelfRefreshSnapshot().running.size).toBe(0);
});
