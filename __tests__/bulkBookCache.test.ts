jest.mock('../src/data/storage', () => ({
  appStorage: { getString: jest.fn(), set: jest.fn(), remove: jest.fn() },
}));
import {
  cacheBookshelfSelection,
  filterBulkBooksByGroup,
  sortBulkBooks,
} from '../src/core/bulkBookCache';
import type { Book, BookSource } from '../src/types';

const source: BookSource = {
  bookSourceUrl: 'source',
  bookSourceName: 'Source',
  bookSourceType: 0,
  customOrder: 0,
  enabled: true,
  enabledExplore: true,
};
const make = (id: string, origin = 'source'): Book => ({
  id,
  name: id,
  author: '',
  intro: '',
  origin,
  bookUrl: id,
  chapterTitle: 'One',
  content: '',
  currentChapterIndex: 1,
  progress: 0,
  updatedAt: 1,
  chapters: [
    { id: `${id}-0`, title: 'Zero', url: `${id}-0`, content: '' },
    { id: `${id}-1`, title: 'One', url: `${id}-1`, content: '' },
  ],
});

test('caches selected books from their current chapters and persists each completion', async () => {
  const books = [make('a'), make('b'), make('c')],
    updated: string[] = [];
  const result = await cacheBookshelfSelection(
    books,
    new Set(['a', 'b']),
    [source],
    {
      fromCurrent: true,
      concurrency: 2,
      load: async (_source, chapter) => `body:${chapter.url}`,
      onBookUpdated: book => updated.push(book.id),
    },
  );
  expect(result).toMatchObject({
    completed: 2,
    total: 2,
    cancelled: false,
    failures: [],
  });
  expect(updated).toEqual(['a', 'b']);
  expect(result.books[0].chapters?.map(item => item.content)).toEqual([
    '',
    'body:a-1',
  ]);
  expect(result.books[2]).toBe(books[2]);
});

test('isolates missing sources and chapter failures across books', async () => {
  const result = await cacheBookshelfSelection(
    [make('good'), make('missing', 'gone')],
    new Set(['good', 'missing']),
    [source],
    {
      fromCurrent: false,
      load: async (_source, chapter) => {
        if (chapter.url.endsWith('-0')) throw new Error('broken');
        return 'ok';
      },
    },
  );
  expect(result.completed).toBe(2);
  expect(result.failures).toHaveLength(2);
  expect(result.books[0].chapters?.map(item => item.content)).toEqual([
    '',
    'ok',
  ]);
});

test('stops before starting another book when cancellation is requested', async () => {
  let cancelled = false;
  const result = await cacheBookshelfSelection(
    [make('a'), make('b')],
    new Set(['a', 'b']),
    [source],
    {
      fromCurrent: false,
      cancelled: () => cancelled,
      load: async () => {
        cancelled = true;
        return 'ok';
      },
    },
  );
  expect(result.cancelled).toBe(true);
  expect(result.completed).toBe(1);
  expect(result.books[1].chapters?.every(item => !item.content)).toBe(true);
});

test('filters cache/export candidates by bookshelf group including ungrouped books', () => {
  const books = [
    { ...make('a'), groupIds: ['g1'] },
    { ...make('b'), groupIds: ['g2', 'g1'] },
    make('c'),
  ];
  expect(filterBulkBooksByGroup(books, 'all').map(book => book.id)).toEqual([
    'a',
    'b',
    'c',
  ]);
  expect(filterBulkBooksByGroup(books, 'g1').map(book => book.id)).toEqual([
    'a',
    'b',
  ]);
  expect(
    filterBulkBooksByGroup(books, 'ungrouped').map(book => book.id),
  ).toEqual(['c']);
});

test('matches Android cache-list sort modes', () => {
  const books = [
    { ...make('Book 10'), latestChapterTime: 10, durChapterTime: 30, order: 2 },
    { ...make('Book 2'), latestChapterTime: 40, durChapterTime: 20, order: 1 },
  ];
  expect(sortBulkBooks(books, 0).map(book => book.id)).toEqual([
    'Book 10',
    'Book 2',
  ]);
  expect(sortBulkBooks(books, 1).map(book => book.id)).toEqual([
    'Book 2',
    'Book 10',
  ]);
  expect(sortBulkBooks(books, 2).map(book => book.id)).toEqual([
    'Book 2',
    'Book 10',
  ]);
  expect(sortBulkBooks(books, 3).map(book => book.id)).toEqual([
    'Book 2',
    'Book 10',
  ]);
  expect(sortBulkBooks(books, 4).map(book => book.id)).toEqual([
    'Book 2',
    'Book 10',
  ]);
});
