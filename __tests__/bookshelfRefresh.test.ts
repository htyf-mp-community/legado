jest.mock('../src/core/webBook', () => ({ loadChapters: jest.fn() }));
import {
  hasUnreadChapters,
  mergeRefreshedChapters,
  refreshBookshelf,
} from '../src/core/bookshelfRefresh';
import type { Book } from '../src/types';

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
