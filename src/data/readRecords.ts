import type { Book } from '../types';
import { appStorage } from './storage';

const KEY = 'reading.records.v1';

export type ReadRecord = {
  bookId: string;
  bookName: string;
  author: string;
  readTime: number;
  lastRead: number;
};

export type ReadRecordSort = 'name' | 'duration' | 'recent';

const text = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

export function normalizeReadRecord(value: unknown): ReadRecord | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const bookId = text(item.bookId),
    bookName = text(item.bookName);
  if (!bookId || !bookName) return null;
  return {
    bookId,
    bookName,
    author: text(item.author),
    readTime: Math.max(
      0,
      Number.isFinite(item.readTime) ? Number(item.readTime) : 0,
    ),
    lastRead: Math.max(
      0,
      Number.isFinite(item.lastRead) ? Number(item.lastRead) : 0,
    ),
  };
}

export function loadReadRecords(): ReadRecord[] {
  try {
    const raw = appStorage.getString(KEY),
      parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed
          .map(normalizeReadRecord)
          .filter((item): item is ReadRecord => !!item)
      : [];
  } catch {
    return [];
  }
}

export function saveReadRecords(records: ReadRecord[]) {
  appStorage.set(KEY, JSON.stringify(records));
  return records;
}

export function recordReadTime(
  book: Book,
  elapsedMs: number,
  now = Date.now(),
) {
  const elapsed = Math.max(0, Math.round(elapsedMs));
  if (!elapsed) return loadReadRecords();
  const records = loadReadRecords(),
    previous = records.find(item => item.bookId === book.id);
  return saveReadRecords([
    {
      bookId: book.id,
      bookName: book.name,
      author: book.author,
      readTime: (previous?.readTime ?? 0) + elapsed,
      lastRead: now,
    },
    ...records.filter(item => item.bookId !== book.id),
  ]);
}

export function removeReadRecord(bookId: string) {
  return saveReadRecords(
    loadReadRecords().filter(item => item.bookId !== bookId),
  );
}

export function clearReadRecords() {
  return saveReadRecords([]);
}

export function selectReadRecords(
  records: ReadRecord[],
  query: string,
  sort: ReadRecordSort,
) {
  const key = query.trim().toLocaleLowerCase(),
    visible = key
      ? records.filter(item =>
          `${item.bookName}\n${item.author}`.toLocaleLowerCase().includes(key),
        )
      : [...records];
  return visible.sort((a, b) =>
    sort === 'duration'
      ? b.readTime - a.readTime
      : sort === 'recent'
        ? b.lastRead - a.lastRead
        : a.bookName.localeCompare(b.bookName),
  );
}

export function formatReadDuration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000)),
    hours = Math.floor(seconds / 3600),
    minutes = Math.floor((seconds % 3600) / 60),
    rest = seconds % 60;
  return { hours, minutes, seconds: rest };
}

export function selectLastReadBookId(records: ReadRecord[], books: Book[]) {
  const available = new Set(books.map(book => book.id));
  return [...records]
    .filter(record => available.has(record.bookId))
    .sort((a, b) => b.lastRead - a.lastRead)[0]?.bookId;
}
