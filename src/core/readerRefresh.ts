import type { Book, BookChapter, BookSource, SearchBook } from '../types';
import { loadBookInfo, loadChapterContent, loadChapterPayload, loadChapters } from './webBook';
import { mapRemoteChapters } from './chapterIdentity';

export async function refreshReaderChapter(
  book: Book,
  chapterIndex: number,
  source: BookSource,
  load?: typeof loadChapterContent,
) {
  const chapter = book.chapters?.[chapterIndex];
  if (!chapter?.url) throw new Error('chapter URL missing');
  const remote: BookChapter = {
    url: chapter.url,
    variable: chapter.variable,
    bookVariable: book.variable,
    bookName: book.name,
    title: chapter.title,
    index: chapterIndex,
    bookUrl: book.bookUrl ?? '',
    baseUrl: chapter.baseUrl ?? book.tocUrl ?? book.bookUrl ?? '',
    isVolume: !!chapter.isVolume,
    isVip: !!chapter.isVip,
    isPay: !!chapter.isPay,
  };
  const payload = load ? {content: await load(source, remote)} : await loadChapterPayload(source, remote);
  const {content} = payload;
  if (!content.trim()) throw new Error('empty chapter content');
  const chapters = book.chapters?.map((item, index) =>
    index === chapterIndex ? { ...item, content, ...('variable' in payload && payload.variable !== undefined ? {variable: payload.variable} : {}) } : item,
  );
  return {
    ...book,
    ...('bookVariable' in payload && payload.bookVariable !== undefined ? {variable: payload.bookVariable} : {}),
    chapters,
    content,
    chapterTitle: chapter.title,
    currentChapterIndex: chapterIndex,
    updatedAt: Date.now(),
  };
}

export class StaleReaderTocError extends Error {
  constructor() { super('reader directory changed while refreshing'); this.name = 'StaleReaderTocError'; }
}

export async function refreshReaderToc(
  book: Book,
  source: BookSource,
  load: typeof loadChapters = loadChapters,
  latest?: () => Book | undefined,
) {
  if (!book.bookUrl || !book.origin)
    throw new Error('online book identity missing');
  const remote: SearchBook = {
    bookUrl: book.bookUrl,
    ...(book.variable ? {variable:book.variable} : {}),
    origin: book.origin,
    originName: book.originName ?? source.bookSourceName,
    name: book.name,
    author: book.author,
    tocUrl: book.tocUrl,
    coverUrl: book.coverUrl,
    intro: book.intro,
    sourceType: book.sourceType,
    reverseToc: book.reverseToc,
  };
  const currentBook = () => {
    const current = latest ? latest() : book;
    if (!current || current.id !== book.id || current.origin !== book.origin ||
        current.bookUrl !== book.bookUrl || current.tocUrl !== book.tocUrl || current.sourceType !== book.sourceType ||
        (current.reverseToc === true) !== (book.reverseToc === true))
      throw new StaleReaderTocError();
    return current;
  };
  let incoming: BookChapter[];
  try { incoming = await load(source, remote); }
  catch (error) { currentBook(); throw error; }
  const currentBookSnapshot = currentBook();
  if (!incoming.length) throw new Error('empty chapter directory');
  const old = currentBookSnapshot.chapters ?? [],
    chapters = mapRemoteChapters(incoming, currentBookSnapshot.id, old, true),
    oldIndex = Math.max(
      0,
      Math.min(currentBookSnapshot.currentChapterIndex ?? 0, Math.max(0, old.length - 1)),
    ),
    currentChapterIndex = Math.min(oldIndex, chapters.length - 1),
    current = chapters[currentChapterIndex],
    position = currentBookSnapshot.readingPosition?.chapterId === old[oldIndex]?.id
      ? currentBookSnapshot.readingPosition : undefined;
  return {
    ...currentBookSnapshot,
    ...(currentBookSnapshot.variable === book.variable && remote.variable !== book.variable
      ? { variable: remote.variable } : {}),
    chapters,
    currentChapterIndex,
    chapterTitle: current.title,
    content: current.content,
    ...(position ? { readingPosition: { ...position, chapterId: current.id } } : {}),
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
      ...(book.variable ? {variable:book.variable} : {}),
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
      ...(info.variable ? {variable:info.variable} : {}),
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
