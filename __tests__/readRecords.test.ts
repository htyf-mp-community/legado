const mockValues = new Map<string, string>();
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => mockValues.get(key),
    set: (key: string, value: string) => mockValues.set(key, value),
  }),
}));
import {
  clearReadRecords,
  formatReadDuration,
  loadReadRecords,
  recordReadTime,
  removeReadRecord,
  selectReadRecords,
  selectLastReadBookId,
} from '../src/data/readRecords';
import type { Book } from '../src/types';
const book = { id: 'book-1', name: 'Demo', author: 'Alice' } as Book;
beforeEach(() => mockValues.clear());
test('accumulates persistent read sessions and updates metadata', () => {
  recordReadTime(book, 1000, 10);
  recordReadTime({ ...book, name: 'Renamed' }, 2500, 20);
  expect(loadReadRecords()).toEqual([
    {
      bookId: 'book-1',
      bookName: 'Renamed',
      author: 'Alice',
      readTime: 3500,
      lastRead: 20,
    },
  ]);
});
test('searches, sorts and deletes reading records', () => {
  recordReadTime(book, 1000, 10);
  recordReadTime(
    { id: 'book-2', name: 'Another', author: 'Bob' } as Book,
    3000,
    30,
  );
  expect(
    selectReadRecords(loadReadRecords(), 'ali', 'name').map(x => x.bookId),
  ).toEqual(['book-1']);
  expect(
    selectReadRecords(loadReadRecords(), '', 'duration').map(x => x.bookId),
  ).toEqual(['book-2', 'book-1']);
  removeReadRecord('book-2');
  expect(loadReadRecords()).toHaveLength(1);
  expect(clearReadRecords()).toEqual([]);
});
test('formats durations without locale-dependent parsing', () =>
  expect(formatReadDuration(3661000)).toEqual({
    hours: 1,
    minutes: 1,
    seconds: 1,
  }));
test('selects the newest readable record and ignores removed books', () => {
  const records = [
    {
      bookId: 'removed',
      bookName: 'Removed',
      author: '',
      readTime: 1,
      lastRead: 30,
    },
    {
      bookId: 'book-1',
      bookName: 'Demo',
      author: '',
      readTime: 1,
      lastRead: 20,
    },
  ];
  expect(selectLastReadBookId(records, [book])).toBe('book-1');
  expect(selectLastReadBookId(records, [])).toBeUndefined();
});
