import {
  assignManagedGroups,
  clearManagedTextCache,
  invertManagedSelection,
  manageShelfBooks,
  reorderManagedBooks,
  selectAllManaged,
  setManagedCanUpdate,
  usedShelfSources,
} from '../src/core/bookshelfManagement';
import { BUILT_IN_GROUPS } from '../src/core/bookshelfGroups';
import type { Book, BookSource } from '../src/types';
const make = (id: string, patch: Partial<Book> = {}): Book => ({
  id,
  name: id,
  author: 'Author',
  intro: 'Intro',
  chapterTitle: 'Chapter',
  content: 'Body',
  chapters: [
    {
      id: 'c',
      title: 'Chapter',
      content: 'Body',
      url: 'https://source/chapter',
    },
  ],
  progress: 0.4,
  updatedAt: 1,
  ...patch,
});
const groups = [
  ...BUILT_IN_GROUPS,
  { id: '1', name: 'One', order: 0, show: false, enableRefresh: true },
  { id: '2', name: 'Two', order: 1, show: true, enableRefresh: true },
];
test('management searches all six native fields case-sensitively and retains group/not-shelf filtering', () => {
  const books = [
    make('Name', {
      origin: 'Origin',
      originName: 'Source',
      kind: 'Fantasy',
      groupIds: ['1'],
    }),
    make('Other'),
    make('Name hidden', { notShelf: true }),
  ];
  for (const query of [
    'Name',
    'Author',
    'Intro',
    'Origin',
    'Source',
    'Fantasy',
  ])
    expect(
      manageShelfBooks(books, groups, '1', 0, query).map(book => book.id),
    ).toEqual(['Name']);
  expect(manageShelfBooks(books, groups, '1', 0, 'name')).toEqual([]);
  expect(manageShelfBooks(books, groups, '-1', 0, ' Name')).toEqual([]);
});
test('native management author-sort setting falls back to reading time', () => {
  expect(
    manageShelfBooks(
      [
        make('a', { author: 'A', durChapterTime: 2 }),
        make('b', { author: 'Z', durChapterTime: 3 }),
      ],
      groups,
      '-1',
      5,
      '',
    ).map(book => book.id),
  ).toEqual(['b', 'a']);
});
test('select-all adds visible items without losing hidden selections; cancel-all clears the entire selection', () => {
  const visible = [make('a'), make('b')],
    selected = new Set(['hidden', 'a']);
  expect([...selectAllManaged(visible, selected, true)]).toEqual([
    'hidden',
    'a',
    'b',
  ]);
  expect([...selectAllManaged(visible, selected, false)]).toEqual([]);
  expect([...invertManagedSelection(visible, selected)]).toEqual([
    'hidden',
    'b',
  ]);
  expect([...selected]).toEqual(['hidden', 'a']);
});
test('move replaces memberships, add unions and remove subtracts, preserving unrelated books and fields', () => {
  const books = [
      make('a', { groupIds: ['1', 'orphan'] }),
      make('b', { groupIds: ['1'] }),
    ],
    ids = new Set(['a']),
    picked = new Set(['2', '-1', 'invalid']);
  expect(
    assignManagedGroups(books, ids, picked, groups, 'move')[0].groupIds,
  ).toEqual(['2']);
  expect(
    assignManagedGroups(books, ids, picked, groups, 'add')[0].groupIds,
  ).toEqual(['1', 'orphan', '2']);
  expect(
    assignManagedGroups(books, ids, new Set(['1']), groups, 'remove')[0]
      .groupIds,
  ).toEqual(['orphan']);
  expect(
    assignManagedGroups(books, ids, new Set(), groups, 'move')[0],
  ).toMatchObject({
    groupIds: [],
    progress: 0.4,
    content: 'Body',
    updatedAt: 1,
  });
  expect(assignManagedGroups(books, ids, picked, groups, 'move')[1]).toBe(
    books[1],
  );
});
test('disabling update clears only the native update-error bit and retains other flags and metadata', () => {
  const books = [
    make('a', { nativeType: 1 | 16 | 32, updateError: true }),
    make('b'),
  ];
  const disabled = setManagedCanUpdate(books, new Set(['a']), false);
  expect(disabled[0]).toMatchObject({
    nativeType: 33,
    updateError: false,
    canUpdate: false,
    progress: 0.4,
  });
  expect(disabled[1]).toBe(books[1]);
  expect(setManagedCanUpdate(books, new Set(['a']), true)[0]).toMatchObject({
    nativeType: 49,
    updateError: true,
    canUpdate: true,
  });
});
test('cache clearing preserves local source text and online chapter identity, position and timestamps', () => {
  const local = make('local', { origin: 'local' });
  expect(clearManagedTextCache(local)).toBe(local);
  expect(clearManagedTextCache(make('online'))).toMatchObject({
    content: '',
    chapters: [{ id: 'c', content: '', url: 'https://source/chapter' }],
    progress: 0.4,
    updatedAt: 1,
  });
});
test('used-source export scans all stored books, including non-shelf records, without duplicates or local/WebDAV origins', () => {
  const sources = [
    'source',
    'preview',
    'unused',
    'loc_book-a',
    'webDav::remote',
  ].map(bookSourceUrl => ({ bookSourceUrl }) as BookSource);
  expect(
    usedShelfSources(
      [
        make('a', { origin: 'source' }),
        make('b', { origin: 'source' }),
        make('c', { origin: 'preview', notShelf: true }),
        make('l', { origin: 'loc_book-a' }),
        make('w', { origin: 'webDav::remote' }),
      ],
      sources,
    ).map(source => source.bookSourceUrl),
  ).toEqual(['source', 'preview']);
});
test('manual multi-row movement uses adjacent order swaps and leaves hidden book positions unchanged', () => {
  const books = [
      make('a', { order: 1 }),
      make('hidden', { order: 2 }),
      make('b', { order: 3 }),
      make('c', { order: 4 }),
    ],
    moved = reorderManagedBooks(books, ['a', 'b', 'c'], 0, 2);
  expect(moved.map(book => [book.id, book.order])).toEqual([
    ['a', 4],
    ['hidden', 2],
    ['b', 1],
    ['c', 3],
  ]);
  expect(books[0].order).toBe(1);
});
test('duplicate orders trigger a global shelf reset with filtered-out slots and non-shelf records preserved', () => {
  const books = [
      make('a', { order: 0 }),
      make('hidden', { order: 0 }),
      make('b', { order: 0 }),
      make('preview', { order: 0, notShelf: true }),
    ],
    moved = reorderManagedBooks(books, ['a', 'b'], 0, 1);
  expect(moved.map(book => [book.id, book.order])).toEqual([
    ['a', 3],
    ['hidden', 2],
    ['b', 1],
    ['preview', 0],
  ]);
});
