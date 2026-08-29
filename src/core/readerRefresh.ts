import type { Book, BookChapter, BookSource, SearchBook } from '../types';
import { loadBookInfo, loadChapterContent, loadChapters } from './webBook';

export async function refreshReaderChapter(
  book: Book,
  chapterIndex: number,
  source: BookSource,
  load: typeof loadChapterContent = loadChapterContent,
) {
  const chapter = book.chapters?.[chapterIndex];
  if (!chapter?.url) throw new Error('chapter URL missing');
  const content = await load(source, {
    url: chapter.url,
    title: chapter.title,
    index: chapterIndex,
    bookUrl: book.bookUrl ?? '',
    baseUrl: chapter.baseUrl ?? book.tocUrl ?? book.bookUrl ?? '',
    isVolume: !!chapter.isVolume,
    isVip: !!chapter.isVip,
    isPay: !!chapter.isPay,
  });
  if (!content.trim()) throw new Error('empty chapter content');
  const chapters = book.chapters?.map((item, index) =>
    index === chapterIndex ? { ...item, content } : item,
  );
  return {
    ...book,
    chapters,
    content,
    chapterTitle: chapter.title,
    currentChapterIndex: chapterIndex,
    updatedAt: Date.now(),
  };
}

export async function refreshReaderToc(
  book: Book,
  source: BookSource,
  load: typeof loadChapters = loadChapters,
) {
  if (!book.bookUrl || !book.origin)
    throw new Error('online book identity missing');
  const remote: SearchBook = {
    bookUrl: book.bookUrl,
    origin: book.origin,
    originName: book.originName ?? source.bookSourceName,
    name: book.name,
    author: book.author,
    tocUrl: book.tocUrl,
    coverUrl: book.coverUrl,
    intro: book.intro,
    sourceType: book.sourceType,
  };
  const incoming = await load(source, remote);
  if (!incoming.length) throw new Error('empty chapter directory');
  const old = book.chapters ?? [],
    byUrl = new Map(
      old.filter(item => item.url).map(item => [item.url!, item]),
    ),
    byTitle = new Map(old.map(item => [item.title, item])),
    chapters = incoming.map((item: BookChapter) => {
      const cached = byUrl.get(item.url) ?? byTitle.get(item.title);
      return {
        id: item.url || `${book.id}:chapter:${item.index}`,
        title: item.title,
        content: cached?.content ?? '',
        url: item.url,
        baseUrl: item.baseUrl,
        isVolume: item.isVolume,
        isVip: item.isVip,
        isPay: item.isPay,
        tag: item.tag,
        wordCount: item.wordCount,
        danmaku: cached?.danmaku,
        lyric: cached?.lyric,
      };
    }),
    oldIndex = Math.max(
      0,
      Math.min(book.currentChapterIndex ?? 0, Math.max(0, old.length - 1)),
    ),
    oldTitle = old[oldIndex]?.title ?? book.chapterTitle,
    matched = chapters.findIndex(item => item.title === oldTitle),
    currentChapterIndex =
      matched >= 0 ? matched : Math.min(oldIndex, chapters.length - 1),
    current = chapters[currentChapterIndex];
  return {
    ...book,
    chapters,
    currentChapterIndex,
    chapterTitle: current.title,
    content: current.content,
    progress: (currentChapterIndex + 1) / chapters.length,
    updatedAt: Date.now(),
  };
}

export async function refreshBookMetadata(
  book: Book,
  source: BookSource,
  infoLoader: typeof loadBookInfo = loadBookInfo,
  tocLoader: typeof loadChapters = loadChapters,
) {
  if (!book.bookUrl || !book.origin)
    throw new Error('online book identity missing');
  const info = await infoLoader(source, {
      bookUrl: book.bookUrl,
      origin: book.origin,
      originName: book.originName ?? source.bookSourceName,
      name: book.name,
      author: book.author,
      tocUrl: book.tocUrl,
      coverUrl: book.coverUrl,
      intro: book.intro,
      sourceType: book.sourceType,
    }),
    updated = {
      ...book,
      name: info.name || book.name,
      author: info.author || book.author,
      intro: info.intro ?? book.intro,
      coverUrl: info.coverUrl ?? book.coverUrl,
      tocUrl: info.tocUrl || book.tocUrl,
      chapterTitle: info.latestChapterTitle || book.chapterTitle,
      updatedAt: Date.now(),
    };
  return refreshReaderToc(updated, source, tocLoader);
}

export function clearReaderChapterCache(
  book: Book,
  currentIndex: number,
  scope: 'after' | 'all',
) {
  const chapters = book.chapters?.map((chapter, index) =>
    scope === 'all' || index >= currentIndex
      ? { ...chapter, content: '' }
      : chapter,
  );
  return {
    ...book,
    chapters,
    content: '',
    currentChapterIndex: currentIndex,
    chapterTitle: chapters?.[currentIndex]?.title ?? book.chapterTitle,
    updatedAt: Date.now(),
  };
}
