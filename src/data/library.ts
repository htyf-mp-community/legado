import type { Book } from '../types';
import { readableChapterIndex } from '../core/readerToc';
import { appStorage } from './storage';
import { sourceTypeFromLegacyBookType } from '../core/bookKinds';
import { addAppLog } from './appLog';
import { normalizeLegacyCover } from '../core/bookCover';
export const LIBRARY_KEY = 'library.v1';
/** Corrupt persisted data is retained for recovery, never replaced by demo books or an empty save. */
export class LibraryReadError extends Error {
  constructor() {
    super('书架数据无法读取，请从备份恢复或重试');
    this.name = 'LibraryReadError';
  }
}
/** Preserve chapter identity and progress while adapting older single-chapter records. */
export function normalizeBook(book: Book): Book {
  const nativeType =
    book.nativeType ??
    (book.sourceType !== undefined && book.sourceType >= 8
      ? book.sourceType
      : undefined);
  const chapters = book.chapters?.length
    ? book.chapters
    : book.pendingCatalog
      ? []
      : [
          {
            id: `${book.id}-legacy`,
            title: book.chapterTitle,
            content: book.content,
          },
        ];
  const index = readableChapterIndex(chapters, book.currentChapterIndex ?? 0);
  return normalizeLegacyCover({
    ...book,
    author: typeof book.author === 'string' ? book.author : '',
    ...(book.sourceType !== undefined && book.sourceType >= 8
      ? {
          nativeType,
          sourceType: sourceTypeFromLegacyBookType(book.sourceType),
        }
      : {}),
    durChapterTime: book.durChapterTime ?? book.updatedAt,
    notShelf: book.notShelf ?? !!((nativeType ?? 0) & 1024),
    chapters,
    currentChapterIndex: index,
    chapterTitle: chapters[index]?.title ?? book.chapterTitle,
    content: chapters[index]?.content ?? book.content,
  });
}
function parseLibrary(value: string | undefined): Book[] {
  // Android's database starts empty; preview fixtures belong in test imports, not the real shelf.
  if (value === undefined) return [];
  try {
    const books: unknown = JSON.parse(value);
    if (
      !Array.isArray(books) ||
      books.some(
        book =>
          !book ||
          typeof book !== 'object' ||
          typeof book.id !== 'string' ||
          typeof book.name !== 'string',
      )
    )
      throw new LibraryReadError();
    return books.map(normalizeBook);
  } catch (error) {
    addAppLog(
      'Failed to read the persisted bookshelf; original data retained',
      error,
    );
    throw new LibraryReadError();
  }
}
export async function loadLibrary(): Promise<Book[]> {
  return parseLibrary(appStorage.getString(LIBRARY_KEY));
}
export type LibrarySnapshot = { books: Book[]; error?: LibraryReadError };
let cachedRaw: string | undefined;
let cachedSnapshot: LibrarySnapshot | undefined;
/** Stable snapshots let React observe writes from import, backup, Web and playback without copying shelf state. */
export function getLibrarySnapshot(): LibrarySnapshot {
  const raw = appStorage.getString(LIBRARY_KEY);
  if (cachedSnapshot && raw === cachedRaw) return cachedSnapshot;
  cachedRaw = raw;
  try {
    cachedSnapshot = { books: parseLibrary(raw) };
  } catch (error) {
    cachedSnapshot = {
      books: [],
      error: error instanceof LibraryReadError ? error : new LibraryReadError(),
    };
  }
  return cachedSnapshot;
}
export function subscribeLibrary(changed: () => void) {
  const listener = appStorage.addOnValueChangedListener(key => {
    if (key === LIBRARY_KEY) changed();
  });
  return () => listener.remove();
}
/** Commit the complete shelf through the application's one MMKV namespace. */
export async function saveLibrary(books: Book[]) {
  const value = JSON.stringify(books);
  if (appStorage.getString(LIBRARY_KEY) !== value)
    appStorage.set(LIBRARY_KEY, value);
}
/** Synchronous read/transform/write before yielding: concurrent imports and per-book updates retain each other's edits. */
export async function updateLibrary(transform: (current: Book[]) => Book[]) {
  const next = transform(parseLibrary(appStorage.getString(LIBRARY_KEY)));
  await saveLibrary(next);
  return next;
}
