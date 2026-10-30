import { parseLegacyJson } from '../core/legacyJson';
import type { Book } from '../types';
import { appStorage } from './storage';
import {
  coalesceReadRecordRows,
  normalizeReadRecord,
  readRecordLong,
  storeReadRecordLong,
  type ReadRecord,
  type ReadRecordShow,
  type ReadRecordSort,
} from '../core/readRecord';
import { mergeReadRecordAuthors } from '../core/readRecordAuthors';
export {
  normalizeReadRecord,
  selectReadRecords,
  formatNativeReadDuration,
  formatReadRecordDate,
  totalReadRecordTime,
} from '../core/readRecord';
export type {
  ReadRecord,
  ReadRecordShow,
  ReadRecordSort,
} from '../core/readRecord';

const KEY = 'reading.records.v1';
export const READ_RECORD_SORT_KEY = 'reading.record-sort.v1';
const ENABLED_KEY = 'reading.record-enabled.v1';
/** The unchanged source readers construct ReadRecord() with its empty deviceId default. */
export const OWN_READ_RECORD_DEVICE = '';

/** Read existing and native-imported rows without eagerly rewriting legacy bookId records. */
export function loadReadRecords(): ReadRecord[] {
  try {
    const raw = appStorage.getString(KEY),
      parsed: unknown = raw ? parseLegacyJson(raw) : [];
    return Array.isArray(parsed)
      ? parsed
          .map(normalizeReadRecord)
          .filter((row): row is ReadRecord => row !== null)
      : [];
  } catch {
    return [];
  }
}
/** Persist millisecond counters and native device/title identity; optional bookId remains a local hint. */
export function saveReadRecords(records: ReadRecord[]) {
  appStorage.set(KEY, JSON.stringify(records));
  return records;
}
/** Native LocalConfig sorting is device-local and excluded from exported/restored backups. */
export function loadReadRecordSort(): ReadRecordSort {
  const value = appStorage.getString(READ_RECORD_SORT_KEY);
  return value === 'duration' || value === 'recent' ? value : 'name';
}
export function saveReadRecordSort(value: ReadRecordSort) {
  appStorage.set(READ_RECORD_SORT_KEY, value);
  return value;
}
/** Source AppConfig default is enabled. Use a string boolean so its backup type is unambiguous. */
export function readRecordEnabled() {
  return appStorage.getString(ENABLED_KEY) !== 'false';
}
export function saveReadRecordEnabled(value: boolean) {
  appStorage.set(ENABLED_KEY, String(value));
  return value;
}

/**
 * Add a reader's elapsed milliseconds to its own device/title counter, merging same-name authors.
 * A renamed book starts a distinct name row. Foreign device counters never enter the own counter.
 * Signed wall-clock deltas and Long overflow follow the source reader; disabling recording skips writes.
 */
export function recordReadTime(
  book: Book,
  elapsedMs: number,
  now = Date.now(),
) {
  if (!readRecordEnabled() || !Number.isFinite(elapsedMs))
    return loadReadRecords();
  const records = coalesceReadRecordRows(loadReadRecords());
  const previous = records.find(
    row =>
      (row.deviceId ?? '') === OWN_READ_RECORD_DEVICE &&
      row.bookName === book.name,
  );
  const row: ReadRecord = {
    ...previous,
    deviceId: OWN_READ_RECORD_DEVICE,
    bookId: book.id,
    bookName: book.name,
    author: mergeReadRecordAuthors(previous?.author ?? '', book.author),
    readTime: storeReadRecordLong(
      BigInt.asIntN(
        64,
        readRecordLong(previous?.readTime) +
          readRecordLong(Math.trunc(elapsedMs)),
      ),
    ),
    lastRead: storeReadRecordLong(readRecordLong(now)),
  };
  return saveReadRecords(
    previous
      ? records.map(item => (item === previous ? row : item))
      : [...records, row],
  );
}

/** Source deleteByName removes every device/author row with the exact title, leaving shelf books intact. */
export function removeReadRecordsByName(bookName: string) {
  return saveReadRecords(
    loadReadRecords().filter(row => row.bookName !== bookName),
  );
}
export function clearReadRecords() {
  return saveReadRecords([]);
}
/** Record activation resolves the first shelf book by exact title, independent of old IDs/authors. */
export function readRecordBookId(
  record: Pick<ReadRecordShow, 'bookName'>,
  books: Book[],
) {
  return books.find(book => book.name === record.bookName)?.id;
}
/** Retain target continuation hints when still valid, otherwise resolve the native title identity. */
export function selectLastReadBookId(records: ReadRecord[], books: Book[]) {
  return [...records]
    .sort((a, b) => {
      const x = readRecordLong(a.lastRead),
        y = readRecordLong(b.lastRead);
      return x > y ? -1 : x < y ? 1 : 0;
    })
    .map(
      row =>
        books.find(book => book.id === row.bookId && book.name === row.bookName)
          ?.id ?? readRecordBookId(row, books),
    )
    .find(id => id !== undefined);
}
