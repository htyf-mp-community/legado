import type { Book, BookChapter, LocalChapter, SearchBook } from '../types';
import { chapterIdentity, mapRemoteChapters } from './chapterIdentity';
import type { ChapterLoadResult } from './chapterPrefetch';
import { mergeSourceVariables } from './sourceVariables';

export type CacheProgress = {
  completed: number;
  failed: number;
  total: number;
  chapterTitle: string;
};
export type CacheFailure = {
  chapterId: string;
  chapterTitle: string;
  message: string;
};

export function mergeRefreshedChapters(
  book: Book,
  info: SearchBook,
  remote: BookChapter[],
): Book {
  if (!remote.length)
    return {
      ...book,
      ...(info.variable ? {variable:info.variable} : {}),
      name: info.name,
      author: info.author,
      intro: info.intro ?? book.intro,
      coverUrl: info.coverUrl ?? book.coverUrl,
      tocUrl: info.tocUrl ?? book.tocUrl,
      updatedAt: Date.now(),
    };
  const chapters: LocalChapter[] = mapRemoteChapters(remote, book.id, book.chapters),
    oldCurrent = book.chapters?.[book.currentChapterIndex ?? 0],
    matched = oldCurrent
      ? chapters.findIndex(chapter => chapterIdentity(chapter) === chapterIdentity(oldCurrent) || chapter.id === oldCurrent.id)
      : chapters.findIndex(chapter => chapter.title === book.chapterTitle),
    currentIndex = Math.max(
      0,
      Math.min(
        chapters.length - 1,
        matched >= 0 ? matched : (book.currentChapterIndex ?? 0),
      ),
    ),
    current = chapters[currentIndex];
  return {
    ...book,
    ...(info.variable ? {variable:info.variable} : {}),
    name: info.name,
    author: info.author,
    intro: info.intro ?? book.intro,
    coverUrl: info.coverUrl ?? book.coverUrl,
    bookUrl: info.bookUrl,
    tocUrl: info.tocUrl,
    chapters,
    currentChapterIndex: currentIndex,
    chapterTitle: current?.title ?? book.chapterTitle,
    content: current?.content ?? '',
    updatedAt: Date.now(),
  };
}

export async function cacheBookChapters(
  book: Book,
  load: (chapter: LocalChapter, index: number) => Promise<ChapterLoadResult>,
  options: {
    fromIndex?: number;
    concurrency?: number;
    cancelled?: () => boolean;
    onProgress?: (progress: CacheProgress) => void;
  } = {},
) {
  const chapters = [...(book.chapters ?? [])],
    fromIndex = Math.max(0, options.fromIndex ?? 0),
    pending = chapters
      .map((chapter, index) => ({ chapter, index }))
      .filter(
        item =>
          item.index >= fromIndex &&
          !!item.chapter.url &&
          !item.chapter.isVolume &&
          !item.chapter.content,
      ),
    failures: CacheFailure[] = [],
    bookVariables: Array<string | undefined> = new Array(chapters.length);
  let cursor = 0,
    completed = 0;
  const report = (chapterTitle: string) =>
    options.onProgress?.({
      completed,
      failed: failures.length,
      total: pending.length,
      chapterTitle,
    });
  const worker = async () => {
    while (cursor < pending.length && !options.cancelled?.()) {
      const item = pending[cursor];
      cursor += 1;
      try {
        const value = await load(item.chapter, item.index);
        if (typeof value !== 'string') bookVariables[item.index] = value.bookVariable;
        chapters[item.index] = typeof value === 'string'
          ? { ...item.chapter, content: value }
          : { ...item.chapter, content: value.content, ...(value.variable !== undefined ? {variable: value.variable} : {}) };
      } catch (reason) {
        failures.push({
          chapterId: item.chapter.id,
          chapterTitle: item.chapter.title,
          message: reason instanceof Error ? reason.message : String(reason),
        });
      } finally {
        completed += 1;
        report(item.chapter.title);
      }
    }
  };
  await Promise.all(
    Array.from(
      {
        length: Math.min(Math.max(1, options.concurrency ?? 3), pending.length),
      },
      () => worker(),
    ),
  );
  const currentIndex = Math.max(
      0,
      Math.min(chapters.length - 1, book.currentChapterIndex ?? 0),
    ),
    current = chapters[currentIndex],
    variable = mergeSourceVariables(book.variable, book.variable, bookVariables);
  return {
    book: {
      ...book,
      ...(variable !== book.variable ? {variable} : {}),
      chapters,
      content: current?.content ?? book.content,
      updatedAt: Date.now(),
    },
    failures,
    completed,
    total: pending.length,
    cancelled: !!options.cancelled?.(),
  };
}
