import type { Book, BookChapter, LocalChapter, SearchBook } from '../types';

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
      name: info.name,
      author: info.author,
      intro: info.intro ?? book.intro,
      coverUrl: info.coverUrl ?? book.coverUrl,
      tocUrl: info.tocUrl ?? book.tocUrl,
      updatedAt: Date.now(),
    };
  const cached = new Map(
      (book.chapters ?? [])
        .filter(chapter => !!chapter.url && !!chapter.content)
        .map(chapter => [chapter.url!, chapter.content]),
    ),
    chapters: LocalChapter[] = remote.map(chapter => ({
      id: chapter.url || `${book.id}:${chapter.index}`,
      title: chapter.title,
      content: cached.get(chapter.url) ?? '',
      url: chapter.url,
      baseUrl: chapter.baseUrl,
      isVolume: chapter.isVolume,
      isVip: chapter.isVip,
      isPay: chapter.isPay,
      tag: chapter.tag,
      wordCount: chapter.wordCount,
    })),
    oldCurrent = book.chapters?.[book.currentChapterIndex ?? 0],
    matched = oldCurrent?.url
      ? chapters.findIndex(chapter => chapter.url === oldCurrent.url)
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
  load: (chapter: LocalChapter, index: number) => Promise<string>,
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
    failures: CacheFailure[] = [];
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
        const content = await load(item.chapter, item.index);
        chapters[item.index] = { ...item.chapter, content };
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
    current = chapters[currentIndex];
  return {
    book: {
      ...book,
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
