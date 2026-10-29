import type { Book, BookChapter, BookSource, SearchBook } from '../types';
import { isLocalBook } from './bookKinds';
import { toLibraryBook } from './onlineLibrary';
import { readableChapterIndex } from './readerToc';
import { migrationChapterIndex } from './chapterMigration';
export function needsBookCatalogue(book: Book | undefined) {
  return (
    !!book &&
    !isLocalBook(book) &&
    book.sourceType !== 3 &&
    !!book.origin &&
    !!book.bookUrl &&
    (book.pendingCatalog === true ||
      (!book.chapters?.some(
        chapter => !!chapter.url || !!chapter.content?.trim(),
      ) &&
        !book.content?.trim()))
  );
}
export async function fetchBookCatalogue(
  book: Book,
  source: BookSource,
  loadInfo: (source: BookSource, value: SearchBook) => Promise<SearchBook>,
  loadToc: (source: BookSource, value: SearchBook) => Promise<BookChapter[]>,
  check: () => void = () => undefined,
  forceInfo = false,
) {
  const search: SearchBook = {
    name: book.name,
    author: book.author,
    intro: book.intro,
    kind: book.kind,
    bookUrl: book.bookUrl!,
    tocUrl: book.tocUrl,
    origin: book.origin!,
    originName: book.originName ?? source.bookSourceName,
    coverUrl: book.coverUrl,
    sourceType: book.sourceType,
  };
  check();
  const info =
    book.tocUrl && !forceInfo ? search : await loadInfo(source, search);
  check();
  const chapters = await loadToc(source, info);
  check();
  if (!chapters.length) throw new Error('目录为空');
  return { info, chapters };
}
export function applyBookCatalogue(
  current: Book,
  before: Book,
  info: SearchBook,
  chapters: BookChapter[],
) {
  if (current.origin !== before.origin || current.bookUrl !== before.bookUrl)
    return current;
  const restored = current.pendingReadingPosition,
    loaded = toLibraryBook(info, chapters),
    index = readableChapterIndex(
      loaded.chapters!,
      restored
        ? migrationChapterIndex(
            restored.chapterIndex,
            restored.chapterTitle,
            chapters,
            restored.totalChapters,
          )
        : (current.currentChapterIndex ?? loaded.currentChapterIndex ?? 0),
    );
  const old = new Map(
    (current.chapters ?? []).map(chapter => [
      chapter.url || chapter.id,
      chapter.content,
    ]),
  );
  const merged = loaded.chapters!.map(chapter => ({
    ...chapter,
    content: old.get(chapter.url || chapter.id) ?? chapter.content,
  }));
  return {
    ...current,
    name:
      current.name === before.name ? info.name || current.name : current.name,
    author:
      current.author === before.author
        ? info.author || current.author
        : current.author,
    intro:
      current.intro === before.intro
        ? (info.intro ?? current.intro)
        : current.intro,
    coverUrl:
      current.coverUrl === before.coverUrl
        ? (info.coverUrl ?? current.coverUrl)
        : current.coverUrl,
    kind:
      current.kind === before.kind ? (info.kind ?? current.kind) : current.kind,
    bookUrl: info.bookUrl,
    tocUrl: info.tocUrl ?? current.tocUrl,
    chapters: merged,
    currentChapterIndex: index,
    ...(restored
      ? {
          readingPosition: {
            chapterId: merged[index].id,
            position: restored.position,
            titleVisible: restored.titleVisible,
          },
          pendingReadingPosition: undefined,
          progress: index / merged.length,
        }
      : {}),
    chapterTitle: merged[index].title,
    content: merged[index].content,
    latestChapterTitle: merged.at(-1)?.title,
    pendingCatalog: false,
    updatedAt: Date.now(),
  };
}
