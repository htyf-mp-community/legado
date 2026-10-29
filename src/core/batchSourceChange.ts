import type { Book, BookChapter, SearchBook } from '../types';
import { onlineBookId, switchLibraryBookSource } from './onlineLibrary';
export function applyBatchSourceChange(
  books: Book[],
  before: Book,
  remote: SearchBook,
  chapters: BookChapter[],
) {
  const latest = books.find(
    book =>
      book.id === before.id &&
      book.bookUrl === before.bookUrl &&
      book.origin === before.origin,
  );
  if (!latest) return { books, saved: false };
  const next = switchLibraryBookSource(latest, remote, chapters),
    conflicts = books.filter(
      book =>
        book.bookUrl === next.bookUrl ||
        (book.name === next.name && book.author === next.author),
    ),
    replacesSelected = conflicts.some(book => book.id === latest.id),
    owner = replacesSelected
      ? latest
      : (conflicts.find(book => book.bookUrl === next.bookUrl) ?? conflicts[0]);
  // Room replaces by URL and the unique (name, author) key. Stable target IDs retain their annotation links.
  next.id = owner?.id ?? onlineBookId(remote);
  const removed = new Set(conflicts.map(book => book.id));
  let inserted = false;
  const result = books.flatMap(book => {
    if (!removed.has(book.id)) return [book];
    if (inserted) return [];
    inserted = true;
    return [next];
  });
  if (!inserted) result.push(next);
  return { books: result, saved: true };
}
