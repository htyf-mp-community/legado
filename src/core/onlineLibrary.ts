import type { Book, BookChapter, SearchBook } from '../types';

export function onlineBookId(book: SearchBook) {
  return `remote:${encodeURIComponent(book.origin)}:${encodeURIComponent(book.bookUrl)}`;
}

export function toLibraryBook(book: SearchBook, chapters: BookChapter[]): Book {
  const localChapters = chapters.map(chapter => ({
    id: chapter.url || `${book.bookUrl}#${chapter.index}`,
    title: chapter.title,
    content: '',
    url: chapter.url,
    baseUrl: chapter.baseUrl,
    isVolume: chapter.isVolume,
    isVip: chapter.isVip,
    isPay: chapter.isPay,
    tag: chapter.tag,
    wordCount: chapter.wordCount,
  }));
  const firstIndex = Math.max(
      0,
      localChapters.findIndex(chapter => !chapter.isVolume),
    ),
    first = localChapters[firstIndex];
  return {
    id: onlineBookId(book),
    name: book.name,
    author: book.author,
    intro: book.intro ?? '',
    chapterTitle: first?.title ?? book.latestChapterTitle ?? '暂无章节',
    content: '',
    chapters: localChapters,
    currentChapterIndex: firstIndex,
    progress: 0,
    updatedAt: Date.now(),
    origin: book.origin,
    originName: book.originName,
    bookUrl: book.bookUrl,
    tocUrl: book.tocUrl,
    coverUrl: book.coverUrl,
    sourceType: book.sourceType,
  };
}

export function switchLibraryBookSource(
  current: Book,
  remote: SearchBook,
  chapters: BookChapter[],
): Book {
  const switched = toLibraryBook(remote, chapters),
    matchedIndex =
      switched.chapters?.findIndex(
        chapter => chapter.title === current.chapterTitle,
      ) ?? -1,
    currentIndex = Math.max(
      0,
      Math.min(
        (switched.chapters?.length ?? 1) - 1,
        matchedIndex >= 0
          ? matchedIndex
          : Math.round(current.progress * (switched.chapters?.length ?? 1)),
      ),
    ),
    chapter = switched.chapters?.[currentIndex];
  return {
    ...switched,
    id: current.id,
    groupIds: current.groupIds,
    progress: current.progress,
    currentChapterIndex: currentIndex,
    chapterTitle: chapter?.title ?? switched.chapterTitle,
    content: chapter?.content ?? '',
    updatedAt: Date.now(),
  };
}
