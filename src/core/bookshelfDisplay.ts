import type { Book, BookGroup } from '../types';
import { simulatedChapterCount } from './readerAdvanced';
import { booksInGroup, sortShelfBooks } from './bookshelfGroups';

export function shelfChapterCount(book: Book, now = new Date()) {
  return simulatedChapterCount(book, book.chapters?.length ?? 1, now);
}
export const shelfHasStarted = (book: Book) =>
  (book.currentChapterIndex ?? 0) > 0 || book.progress > 0;
export function shelfReadProgress(book: Book, now = new Date()) {
  if (!shelfHasStarted(book)) return undefined;
  const count = shelfChapterCount(book, now);
  return count <= 1
    ? 1
    : Math.min(1, Math.max(0, (book.currentChapterIndex ?? 0) / (count - 1)));
}
export function shelfUnreadCount(book: Book, now = new Date()) {
  return Math.max(
    0,
    shelfChapterCount(book, now) - (book.currentChapterIndex ?? 0) - 1,
  );
}
export function shelfSummary(books: Book[]) {
  const shelf = books.filter(book => !book.notShelf);
  return {
    total: shelf.length,
    reading: shelf.filter(shelfHasStarted).length,
    recent: [...shelf].sort(
      (a, b) =>
        Number(shelfHasStarted(b)) - Number(shelfHasStarted(a)) ||
        (b.durChapterTime ?? b.updatedAt) - (a.durChapterTime ?? a.updatedAt),
    )[0],
  };
}
/** Folder adapters in this source fall back to reading time for author-sort (5). */
export const folderShelfSort = (sort: number) => (sort === 5 ? 0 : sort);
export function folderPreviewBooks(
  books: Book[],
  groups: BookGroup[],
  group: BookGroup,
  sort: number,
) {
  return group.cover?.trim()
    ? []
    : sortShelfBooks(
        booksInGroup(books, group.id, groups),
        folderShelfSort(
          group.bookSort === undefined || group.bookSort < 0
            ? sort
            : group.bookSort,
        ),
      ).slice(0, 4);
}
export function shelfTimeAgo(time: number, now = Date.now()) {
  const seconds = Math.abs(now - time) / 1000;
  const unit =
    seconds < 60
      ? [1, '秒']
      : seconds < 3600
        ? [60, '分钟']
        : seconds < 86400
          ? [3600, '小时']
          : seconds < 604800
            ? [86400, '天']
            : seconds < 2628000
              ? [604800, '周']
              : seconds < 31536000
                ? [2628000, '月']
                : [31536000, '年'];
  return `${Math.floor(seconds / Number(unit[0]))}${unit[1]}${time < now ? '前' : '后'}`;
}
