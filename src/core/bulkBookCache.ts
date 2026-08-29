import type { Book, BookChapter, BookSource } from '../types';
import type { BookGroupSort } from '../data/bookshelf';
import { cacheBookChapters } from './bookCache';
import { loadChapterContent } from './webBook';

export type BulkBookGroupFilter = 'all' | 'ungrouped' | string;
export function filterBulkBooksByGroup(
  books: Book[],
  group: BulkBookGroupFilter,
) {
  if (group === 'all') return books;
  if (group === 'ungrouped')
    return books.filter(book => !book.groupIds?.length);
  return books.filter(book => book.groupIds?.includes(group));
}

export function sortBulkBooks(books: Book[], sort: BookGroupSort) {
  return [...books].sort((left, right) => {
    if (sort === 1)
      return (
        (right.latestChapterTime ?? right.updatedAt) -
        (left.latestChapterTime ?? left.updatedAt)
      );
    if (sort === 2)
      return left.name.localeCompare(right.name, undefined, { numeric: true });
    if (sort === 3) return (left.order ?? 0) - (right.order ?? 0);
    if (sort === 4)
      return (
        Math.max(
          right.latestChapterTime ?? 0,
          right.durChapterTime ?? right.updatedAt,
        ) -
        Math.max(
          left.latestChapterTime ?? 0,
          left.durChapterTime ?? left.updatedAt,
        )
      );
    return (
      (right.durChapterTime ?? right.updatedAt) -
      (left.durChapterTime ?? left.updatedAt)
    );
  });
}

export type BulkBookCacheProgress = {
  bookId: string;
  bookName: string;
  bookCompleted: number;
  bookTotal: number;
  chapterCompleted: number;
  chapterTotal: number;
  chapterFailed: number;
  chapterTitle: string;
};
export type BulkBookCacheFailure = {
  bookId: string;
  bookName: string;
  message: string;
};

export async function cacheBookshelfSelection(
  books: Book[],
  selectedIds: ReadonlySet<string>,
  sources: BookSource[],
  options: {
    fromCurrent: boolean;
    concurrency?: number;
    cancelled?: () => boolean;
    onProgress?: (value: BulkBookCacheProgress) => void;
    onBookUpdated?: (book: Book) => void;
    load?: typeof loadChapterContent;
  },
) {
  const targets = books.filter(book => selectedIds.has(book.id));
  const replacements = new Map<string, Book>(),
    failures: BulkBookCacheFailure[] = [];
  let bookCompleted = 0,
    chapterCompleted = 0,
    chapterTotal = targets.reduce(
      (sum, book) =>
        sum +
        (book.chapters?.filter(
          (chapter, index) =>
            index >=
              (options.fromCurrent ? (book.currentChapterIndex ?? 0) : 0) &&
            chapter.url &&
            !chapter.isVolume &&
            !chapter.content,
        ).length ?? 0),
      0,
    );
  for (const book of targets) {
    if (options.cancelled?.()) break;
    const source = sources.find(item => item.bookSourceUrl === book.origin);
    if (!source) {
      failures.push({
        bookId: book.id,
        bookName: book.name,
        message: 'source missing',
      });
      bookCompleted += 1;
      continue;
    }
    try {
      const result = await cacheBookChapters(
        book,
        (chapter, index) => {
          const remote: BookChapter = {
            url: chapter.url!,
            title: chapter.title,
            index,
            bookUrl: book.bookUrl ?? '',
            baseUrl: chapter.baseUrl ?? book.tocUrl ?? book.bookUrl ?? '',
            isVolume: !!chapter.isVolume,
            isVip: !!chapter.isVip,
            isPay: !!chapter.isPay,
          };
          return (options.load ?? loadChapterContent)(source, remote);
        },
        {
          fromIndex: options.fromCurrent ? (book.currentChapterIndex ?? 0) : 0,
          concurrency: options.concurrency,
          cancelled: options.cancelled,
          onProgress: progress => {
            options.onProgress?.({
              bookId: book.id,
              bookName: book.name,
              bookCompleted,
              bookTotal: targets.length,
              chapterCompleted: chapterCompleted + progress.completed,
              chapterTotal,
              chapterFailed: progress.failed,
              chapterTitle: progress.chapterTitle,
            });
          },
        },
      );
      replacements.set(book.id, result.book);
      options.onBookUpdated?.(result.book);
      chapterCompleted += result.completed;
      if (result.failures.length)
        failures.push({
          bookId: book.id,
          bookName: book.name,
          message: `${result.failures.length} chapter(s) failed`,
        });
    } catch (error) {
      failures.push({
        bookId: book.id,
        bookName: book.name,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    bookCompleted += 1;
  }
  return {
    books: books.map(book => replacements.get(book.id) ?? book),
    completed: bookCompleted,
    total: targets.length,
    failures,
    cancelled: !!options.cancelled?.(),
  };
}
