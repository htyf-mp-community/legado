import type { Book, BookSource, LocalChapter, SearchBook } from '../types';
import { allSettledLimited } from './concurrency';
import { loadChapters } from './webBook';

export type BookshelfRefreshResult = {
  books: Book[];
  attempted: number;
  updated: number;
  failed: number;
};

export const hasUnreadChapters = (book: Book) =>
  (book.chapters?.length ?? 0) > (book.currentChapterIndex ?? 0) + 1;

const searchBook = (book: Book, source: BookSource): SearchBook => ({
  name: book.name,
  author: book.author,
  bookUrl: book.bookUrl ?? '',
  origin: book.origin ?? '',
  originName: book.originName ?? source.bookSourceName,
  tocUrl: book.tocUrl,
  sourceType: book.sourceType,
});

export function mergeRefreshedChapters(
  book: Book,
  incoming: Awaited<ReturnType<typeof loadChapters>>,
): Book {
  const old = new Map(
    (book.chapters ?? []).map(chapter => [chapter.url ?? chapter.id, chapter]),
  );
  const chapters: LocalChapter[] = incoming.map(chapter => ({
    id: chapter.url || `${book.id}-${chapter.index}`,
    title: chapter.title,
    content: old.get(chapter.url)?.content ?? '',
    url: chapter.url,
    baseUrl: chapter.baseUrl,
    isVolume: chapter.isVolume,
    isVip: chapter.isVip,
    isPay: chapter.isPay,
    tag: chapter.tag,
    wordCount: chapter.wordCount,
  }));
  const index = Math.max(
    0,
    Math.min(chapters.length - 1, book.currentChapterIndex ?? 0),
  );
  return chapters.length
    ? {
        ...book,
        chapters,
        currentChapterIndex: index,
        chapterTitle: chapters[index].title,
        content: chapters[index].content,
        updatedAt: Date.now(),
      }
    : book;
}

export async function refreshBookshelf(
  books: Book[],
  sources: BookSource[],
  options: { concurrency: number; onlyUpdateRead: boolean },
): Promise<BookshelfRefreshResult> {
  const sourceMap = new Map(
    sources.map(source => [source.bookSourceUrl, source]),
  );
  const candidates = books.filter(
    book =>
      book.canUpdate !== false &&
      Boolean(book.origin && book.bookUrl && sourceMap.has(book.origin)) &&
      (!options.onlyUpdateRead || !hasUnreadChapters(book)),
  );
  const results = await allSettledLimited(
    candidates.map(book => async () => {
      const source = sourceMap.get(book.origin!)!;
      return mergeRefreshedChapters(
        book,
        await loadChapters(source, searchBook(book, source)),
      );
    }),
    options.concurrency,
  );
  const replacements = new Map<string, Book>();
  let failed = 0;
  results.forEach((result, index) => {
    if (result.status === 'fulfilled')
      replacements.set(candidates[index].id, result.value);
    else failed += 1;
  });
  return {
    books: books.map(book => replacements.get(book.id) ?? book),
    attempted: candidates.length,
    updated: replacements.size,
    failed,
  };
}
