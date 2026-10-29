import type { Book, BookGroup } from '../src/types';
import { booksInGroup, BUILT_IN_GROUPS } from '../src/core/bookshelfGroups';
import {
  folderPreviewBooks,
  shelfReadProgress,
  shelfSummary,
  shelfTimeAgo,
  shelfUnreadCount,
} from '../src/core/bookshelfDisplay';
const book = (id: string, extra: Partial<Book> = {}): Book => ({
  id,
  name: id,
  author: '',
  intro: '',
  chapterTitle: '',
  content: '',
  updatedAt: 1,
  progress: 0,
  chapters: Array.from({ length: 5 }, (_, i) => ({
    id: `${i}`,
    title: `${i}`,
    content: '',
  })),
  ...extra,
});
test('progress follows chapter index, including first-chapter, single-chapter and never-started cases', () => {
  expect(shelfReadProgress(book('not-started'))).toBeUndefined();
  expect(shelfReadProgress(book('first', { progress: 0.5 }))).toBe(0);
  expect(
    shelfReadProgress(
      book('middle', { currentChapterIndex: 2, progress: 0.9 }),
    ),
  ).toBe(0.5);
  expect(
    shelfReadProgress(
      book('single', {
        progress: 0.1,
        chapters: [{ id: '1', title: '1', content: '' }],
      }),
    ),
  ).toBe(1);
  expect(shelfReadProgress(book('past-end', { currentChapterIndex: 99 }))).toBe(
    1,
  );
});
test('simulated reading limits progress and unread chapters to currently unlocked chapters', () => {
  const value = book('simulated', {
    currentChapterIndex: 1,
    simulatedReading: {
      enabled: true,
      startDate: '2026-10-27',
      startChapter: 0,
      dailyChapters: 1,
    },
  });
  const now = new Date('2026-10-28T12:00:00');
  expect(shelfReadProgress(value, now)).toBe(1);
  expect(shelfUnreadCount(value, now)).toBe(0);
  expect(
    shelfUnreadCount(book('normal', { currentChapterIndex: 1 }), now),
  ).toBe(3);
});
test('global summary excludes off-shelf entries and prioritizes started books over fresh imports', () => {
  const result = shelfSummary([
    book('import', { updatedAt: 100 }),
    book('read', { updatedAt: 1, progress: 0.1 }),
    book('notShelf', {
      notShelf: true,
      currentChapterIndex: 3,
      updatedAt: 200,
    }),
  ]);
  expect(result.total).toBe(2);
  expect(result.reading).toBe(1);
  expect(result.recent?.id).toBe('read');
  expect(shelfSummary([]).recent).toBeUndefined();
});
test('folder previews use four source-sorted books or the custom cover without preview books', () => {
  const group: BookGroup = {
    id: '-1',
    name: 'All',
    order: 0,
    show: true,
    enableRefresh: true,
    bookSort: 5,
  };
  const books = Array.from({ length: 6 }, (_, i) =>
    book(`${i}`, { updatedAt: i }),
  );
  expect(
    folderPreviewBooks(books, [], group, 2).map(value => value.id),
  ).toEqual(['5', '4', '3', '2']);
  expect(
    folderPreviewBooks(books, [], { ...group, cover: 'file:///cover.jpg' }, 2),
  ).toEqual([]);
});
test('folder root mirrors native SQL visibility and only displays ungrouped online text', () => {
  const groups = [
    ...BUILT_IN_GROUPS.map(value => ({
      ...value,
      show: value.id === '-4' ? false : value.show,
    })),
    { id: '1', name: 'User', order: 1, show: true, enableRefresh: true },
  ];
  const books = [
    book('text'),
    book('local', { localUri: 'file:///a' }),
    book('audio', { sourceType: 1 }),
    book('grouped', { groupIds: ['1'] }),
    book('manga', { sourceType: 2 }),
  ];
  expect(booksInGroup(books, '-100', groups).map(value => value.id)).toEqual([
    'text',
  ]);
  expect(
    booksInGroup(
      books,
      '-100',
      groups.map(value => ({ ...value, show: true })),
    ),
  ).toEqual([]);
  expect(
    booksInGroup(
      books,
      '-100',
      groups.filter(value => value.id !== '1'),
    ),
  ).toEqual([]);
});
test('update ages retain source time thresholds and future suffix', () => {
  expect(shelfTimeAgo(0, 61000)).toBe('1分钟前');
  expect(shelfTimeAgo(120000, 0)).toBe('2分钟后');
  expect(shelfTimeAgo(0, 8 * 86400000)).toBe('1周前');
});
