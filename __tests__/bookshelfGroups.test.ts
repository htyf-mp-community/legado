import {
  BUILT_IN_GROUPS,
  booksInGroup,
  setBooksGroups,
  sortShelfBooks,
  visibleBookGroups,
} from '../src/core/bookshelfGroups';
import {
  bookReadingScreen,
  isLocalBook,
  sourceTypeFromLegacyBookType,
} from '../src/core/bookKinds';
import type { Book, BookGroup } from '../src/types';
const make = (id: string, patch: Partial<Book> = {}): Book => ({
  id,
  name: id,
  author: '',
  intro: '',
  chapterTitle: 'C',
  content: '',
  progress: 0,
  updatedAt: 1,
  ...patch,
});
const groups = (): BookGroup[] => BUILT_IN_GROUPS.map(group => ({ ...group }));
const ids = (books: Book[]) => books.map(book => book.id);
test('only All is visible on an empty source shelf', () =>
  expect(visibleBookGroups(groups(), []).map(group => group.id)).toEqual([
    '-1',
  ]));
test('built-in tabs follow the source type/local/unassigned predicates', () => {
  const books = [
    make('local', { localUri: 'file:///book.txt' }),
    make('net'),
    make('audio', { sourceType: 1 }),
    make('video', { sourceType: 4 }),
    make('failed', { updateError: true }),
  ];
  expect(visibleBookGroups(groups(), books).map(group => group.id)).toEqual([
    '-1',
    '-2',
    '-3',
    '-4',
    '-6',
    '-11',
  ]);
  expect(ids(booksInGroup(books, '-4', groups()))).toEqual(['net', 'failed']);
  expect(ids(booksInGroup(books, '-2', groups()))).toEqual(['local']);
});
test('hidden or removed user groups have distinct unassigned behavior', () => {
  const configured = [
    ...groups(),
    { id: '1', name: 'Hidden', order: 1, show: false, enableRefresh: true },
  ];
  const books = [
    make('assigned', { groupIds: ['1'] }),
    make('orphan', { groupIds: ['removed'] }),
  ];
  expect(ids(booksInGroup(books, '-4', configured))).toEqual(['orphan']);
  expect(visibleBookGroups(configured, books).map(group => group.id)).toEqual([
    '-1',
    '-4',
  ]);
});
test('temporary non-shelf records are not shown in a group', () =>
  expect(
    booksInGroup([make('temporary', { notShelf: true })], '-1', groups()),
  ).toEqual([]));
test('local audio is in both Local and Audio; Local unassigned stays hidden by default', () => {
  const books = [make('a', { sourceType: 1, nativeType: 288 })];
  expect(isLocalBook(books[0])).toBe(true);
  expect(visibleBookGroups(groups(), books).map(group => group.id)).toEqual([
    '-1',
    '-2',
    '-3',
  ]);
});
test('all six sort modes use source timestamps and simplified-Chinese collation without mutating input', () => {
  const books = [
    make('a', {
      name: 'Book 10',
      author: '张',
      durChapterTime: 30,
      latestChapterTime: 10,
      order: 2,
    }),
    make('b', {
      name: 'Book 2',
      author: '李',
      durChapterTime: 20,
      latestChapterTime: 40,
      order: 1,
    }),
  ];
  expect(
    [0, 1, 2, 3, 4, 5].map(sort => ids(sortShelfBooks(books, sort))),
  ).toEqual([
    ['a', 'b'],
    ['b', 'a'],
    ['a', 'b'],
    ['b', 'a'],
    ['b', 'a'],
    ['b', 'a'],
  ]);
  expect(ids(books)).toEqual(['a', 'b']);
  expect(
    ids(sortShelfBooks([{ ...books[0], updatedAt: 9999 }, books[1]], 0)),
  ).toEqual(['a', 'b']);
});
test('bulk assignment can replace and clear membership without assigning built-in groups', () => {
  const configured = [
    ...groups(),
    { id: '1', name: 'Custom', order: 0, show: true, enableRefresh: true },
  ];
  const books = [
    make('a', { groupIds: ['orphan'] }),
    make('b', { groupIds: ['1'] }),
  ];
  expect(
    setBooksGroups(books, new Set(['a']), new Set(['-1', '1']), configured)[0]
      .groupIds,
  ).toEqual(['1']);
  const cleared = setBooksGroups(books, new Set(['a']), new Set(), configured);
  expect(cleared[0].groupIds).toEqual([]);
  expect(cleared[1]).toBe(books[1]);
});
test.each([
  [8, 0],
  [32, 1],
  [64, 2],
  [4, 4],
  [128, 3],
  [264, 0],
  [288, 1],
  [272, 0],
])('maps native type %s to source category %s', (native, type) =>
  expect(sourceTypeFromLegacyBookType(native)).toBe(type),
);
test('reading destinations distinguish text, image, audio and video', () => {
  expect(
    [0, 2, 1, 4].map(sourceType =>
      bookReadingScreen(make('book', { sourceType })),
    ),
  ).toEqual(['Reader', 'Reader', 'AudioPlayer', 'VideoBook']);
});
