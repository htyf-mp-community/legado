import type { Book, BookSource, LocalChapter, SearchBook } from '../types';
import { booksInGroup } from './bookshelfGroups';
import type { BookGroup } from '../types';
import { allSettledLimited } from './concurrency';
import { loadChapters } from './webBook';
import { isLocalBook } from './bookKinds';
import { shelfUnreadCount } from './bookshelfDisplay';
import { trackBookshelfRefresh } from '../services/bookshelfRefreshRuntime';

export type BookshelfRefreshResult = {
  books: Book[];
  attempted: number;
  updated: number;
  failed: number;
};

export const hasUnreadChapters = (book: Book) => shelfUnreadCount(book) > 0;

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
        latestChapterTime:
          incoming.length !== (book.chapters?.length ?? 0) ||
          incoming.at(-1)?.title !== book.chapters?.at(-1)?.title
            ? Date.now()
            : book.latestChapterTime,
        updateError: false,
        latestChapterTitle: chapters.at(-1)?.title,
        lastCheckCount: Math.max(
          0,
          incoming.length - (book.chapters?.length ?? 0),
        ),
      }
    : book;
}

export async function refreshBookshelf(
  books: Book[],
  sources: BookSource[],
  options: {
    concurrency: number;
    onlyUpdateRead: boolean;
    groupId?: string;
    groups?: BookGroup[];
    onBookUpdated?: (before: Book, updated: Book) => Promise<void> | void;
  },
): Promise<BookshelfRefreshResult> {
  const sourceMap = new Map(
    sources.map(source => [source.bookSourceUrl, source]),
  );
  const candidates = (
    options.groupId
      ? booksInGroup(books, options.groupId, options.groups ?? [])
      : books
  ).filter(
    book =>
      !book.notShelf &&
      !isLocalBook(book) &&
      book.canUpdate !== false &&
      Boolean(book.origin && book.bookUrl && sourceMap.has(book.origin)) &&
      (!options.onlyUpdateRead || !hasUnreadChapters(book)),
  );
  const tracking = trackBookshelfRefresh(candidates.map(book => book.id));
  const results = await (async () => {
    try {
      return await allSettledLimited(
        candidates.map(book => async () => {
          tracking.start(book.id);
          try {
            const source = sourceMap.get(book.origin!)!;
            let updated: Book;
            try {
              const chapters = await loadChapters(
                source,
                searchBook(book, source),
              );
              if (!chapters.length) throw new Error('目录为空');
              updated = mergeRefreshedChapters(book, chapters);
            } catch (cause) {
              await options.onBookUpdated?.(book, {
                ...book,
                updateError: true,
              });
              throw cause;
            }
            await options.onBookUpdated?.(book, updated);
            return updated;
          } finally {
            tracking.finish(book.id);
          }
        }),
        options.concurrency,
      );
    } finally {
      tracking.dispose();
    }
  })();
  const replacements = new Map<string, Book>();
  let failed = 0;
  results.forEach((result, index) => {
    if (result.status === 'fulfilled')
      replacements.set(candidates[index].id, result.value);
    else {
      failed += 1;
      replacements.set(candidates[index].id, {
        ...candidates[index],
        updateError: true,
      });
    }
  });
  return {
    books: books.map(book => replacements.get(book.id) ?? book),
    attempted: candidates.length,
    updated: results.filter(result => result.status === 'fulfilled').length,
    failed,
  };
}

/** Apply only refresh changes against the current shelf, keeping imports, deletions, edits and reading progress made while fetching. */
export function applyBookshelfRefresh(
  current: Book[],
  before: Book[],
  refreshed: Book[],
) {
  const baseline = new Map(before.map(book => [book.id, book]));
  const changes = new Map(
    refreshed
      .filter(book => baseline.get(book.id) !== book)
      .map(book => [book.id, book]),
  );
  return current.map(book => {
    const incoming = changes.get(book.id);
    if (!incoming) return book;
    const previous = baseline.get(book.id);
    if (
      previous &&
      (previous.bookUrl !== book.bookUrl || previous.origin !== book.origin)
    )
      return book;
    if (incoming.updateError || !incoming.chapters?.length)
      return { ...book, updateError: incoming.updateError };
    const currentChapter = book.chapters?.[book.currentChapterIndex ?? 0];
    const cached = new Map(
      (book.chapters ?? []).map(chapter => [
        chapter.url || chapter.id,
        chapter.content,
      ]),
    );
    const chapters = incoming.chapters.map(chapter => ({
      ...chapter,
      content: cached.get(chapter.url || chapter.id) ?? chapter.content,
    }));
    const identity = currentChapter?.url || currentChapter?.id;
    const located = identity
      ? chapters.findIndex(chapter => (chapter.url || chapter.id) === identity)
      : -1;
    const index =
      located >= 0
        ? located
        : Math.max(
            0,
            Math.min(chapters.length - 1, book.currentChapterIndex ?? 0),
          );
    return {
      ...book,
      chapters,
      currentChapterIndex: index,
      chapterTitle: chapters[index].title,
      content: chapters[index].content,
      latestChapterTime: incoming.latestChapterTime ?? book.latestChapterTime,
      lastCheckCount: incoming.lastCheckCount,
      latestChapterTitle: incoming.latestChapterTitle,
      updateError: incoming.updateError,
      updatedAt: Math.max(book.updatedAt, incoming.updatedAt),
    };
  });
}
