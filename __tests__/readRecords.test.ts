const mockValues = new Map<string, string>();
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => mockValues.get(key),
    set: (key: string, value: string) => mockValues.set(key, value),
  }),
}));
import {
  clearReadRecords,
  formatNativeReadDuration,
  loadReadRecords,
  recordReadTime,
  removeReadRecordsByName,
  selectReadRecords,
  selectLastReadBookId,
  readRecordBookId,
} from '../src/data/readRecords';
import type { Book } from '../src/types';
const book = { id: 'book-1', name: 'Demo', author: 'Alice' } as Book;
beforeEach(() => mockValues.clear());
test('same-title sessions share an own-device row while a renamed title keeps a separate history', () => {
  recordReadTime(book, 1000, 10);
  recordReadTime({ ...book, id: 'other-source' }, 500, 15);
  recordReadTime({ ...book, name: 'Renamed' }, 2500, 20);
  expect(loadReadRecords()).toEqual([
    {
      deviceId: '',
      bookId: 'other-source',
      bookName: 'Demo',
      author: 'Alice',
      readTime: 1500,
      lastRead: 15,
    },
    {
      deviceId: '',
      bookId: 'book-1',
      bookName: 'Renamed',
      author: 'Alice',
      readTime: 2500,
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
    selectReadRecords(loadReadRecords(), 'ali', 'name').map(x => x.bookName),
  ).toEqual(['Demo']);
  expect(
    selectReadRecords(loadReadRecords(), '', 'duration').map(x => x.bookName),
  ).toEqual(['Another', 'Demo']);
  removeReadRecordsByName('Another');
  expect(loadReadRecords()).toHaveLength(1);
  expect(clearReadRecords()).toEqual([]);
});
test('formats native durations without zero units', () =>
  expect(formatNativeReadDuration(3661000)).toBe('1小时1分钟1秒'));
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

test('native display groups identical names across devices before author filtering', () => {
  mockValues.set(
    'reading.records.v1',
    JSON.stringify([
      {
        bookId: 'a',
        deviceId: '',
        bookName: '同名',
        author: '甲',
        readTime: 1000,
        lastRead: 10,
      },
      {
        bookId: 'b',
        deviceId: 'other',
        bookName: '同名',
        author: '乙',
        readTime: 2000,
        lastRead: 20,
      },
      {
        bookId: 'c',
        deviceId: '',
        bookName: '另一册',
        author: '甲',
        readTime: 4000,
        lastRead: 30,
      },
    ]),
  );
  const visible = selectReadRecords(loadReadRecords(), '乙', 'duration');
  expect(visible).toHaveLength(1);
  expect(visible[0]).toMatchObject({
    bookName: '同名',
    readTime: 3000,
    lastRead: 20,
    displayAuthor: '乙、甲',
  });
  expect(selectReadRecords(loadReadRecords(), '%', 'name')).toHaveLength(2);
});

test('foreign device time stays separate and deletion removes all exact-name rows', () => {
  mockValues.set(
    'reading.records.v1',
    JSON.stringify([
      {
        deviceId: 'remote',
        bookName: 'Demo',
        author: 'Bob',
        readTime: 9000,
        lastRead: 10,
      },
      {
        bookId: 'legacy-a',
        bookName: 'Demo',
        author: 'Alice',
        readTime: 1000,
        lastRead: 5,
      },
      {
        bookId: 'legacy-b',
        bookName: 'Demo',
        author: 'Other',
        readTime: 2000,
        lastRead: 6,
      },
      {
        bookId: 'keep',
        bookName: 'Demo ',
        author: '',
        readTime: 100,
        lastRead: 1,
      },
    ]),
  );
  recordReadTime(book, 500, 20);
  const rows = loadReadRecords();
  expect(rows.find(row => row.deviceId === 'remote')?.readTime).toBe(9000);
  expect(rows.find(row => row.deviceId === '')?.readTime).toBe(3500);
  expect(selectReadRecords(rows, '', 'duration')[0].readTime).toBe(12500);
  removeReadRecordsByName('Demo');
  expect(loadReadRecords().map(row => row.bookName)).toEqual(['Demo ']);
});
test('disabled recording skips writes, zero deltas still update and signed deltas preserve the native counter', () => {
  mockValues.set('reading.record-enabled.v1', 'false');
  expect(recordReadTime(book, 1000, 10)).toEqual([]);
  mockValues.set('reading.record-enabled.v1', 'true');
  recordReadTime(book, 0, 10);
  recordReadTime(book, -100, 20);
  expect(loadReadRecords()[0]).toMatchObject({ readTime: -100, lastRead: 20 });
});

test('loads and updates exact native Long values without JSON integer rounding', () => {
  mockValues.set(
    'reading.records.v1',
    '[{"bookName":"Demo","author":"Alice","deviceId":"","readTime":9223372036854775807,"lastRead":9007199254740993}]',
  );
  expect(loadReadRecords()[0]).toMatchObject({
    readTime: '9223372036854775807',
    lastRead: '9007199254740993',
  });
  recordReadTime(book, 1, 20);
  expect(loadReadRecords()[0].readTime).toBe('-9223372036854775808');
});

test('activation finds the first exact-name shelf book even when the stored ID is missing or obsolete', () => {
  const second = { ...book, id: 'new-id', author: 'Different' };
  expect(readRecordBookId({ bookName: 'Demo' }, [second, book])).toBe('new-id');
  expect(
    readRecordBookId({ bookName: 'Demo ' }, [second, book]),
  ).toBeUndefined();
});
