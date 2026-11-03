import type { Book, BookChapter, SearchBook } from '../types';
import { migrationChapterIndex } from './chapterMigration';
import { mapRemoteChapters } from './chapterIdentity';
import { isLocalBook } from './bookKinds';
const nativeTypeForSource = (sourceType?: number) =>
  [8, 32, 64, 136, 4][sourceType ?? 0] ?? 8;

export function onlineBookId(book: SearchBook) {
  return `remote:${encodeURIComponent(book.origin)}:${encodeURIComponent(book.bookUrl)}`;
}

export function mergeOnlineBookIntoShelf(current: Book[], incoming: Book): Book[] {
  const existing = current.find(item => item.id === incoming.id);
  const sameOnlineBook = existing && incoming.origin && incoming.bookUrl &&
    !isLocalBook(existing) && !isLocalBook(incoming) &&
    existing.origin === incoming.origin && existing.bookUrl === incoming.bookUrl;
  if (!sameOnlineBook) {
    return [...current.filter(item => item.id !== incoming.id), incoming];
  }
  if (!existing.notShelf && !((existing.nativeType ?? 0) & 1024)) return current;
  return current.map(item => item.id === existing.id ? {
    ...existing,
    notShelf: false,
    ...(existing.nativeType === undefined ? {} : { nativeType: existing.nativeType & ~1024 }),
  } : item);
}

export function toLibraryBook(book: SearchBook, chapters: BookChapter[]): Book {
  const localChapters = mapRemoteChapters(chapters, book.bookUrl);
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
    ...(book.variable ? {variable: book.variable} : {}),
    tocUrl: book.tocUrl,
    coverUrl: book.coverUrl,
    sourceType: book.sourceType,
    nativeType: nativeTypeForSource(book.sourceType),
    kind: book.kind,
    wordCount: book.wordCount,
    latestChapterTitle: book.latestChapterTitle,
  };
}

export function switchLibraryBookSource(
  current: Book,
  remote: SearchBook,
  chapters: BookChapter[],
): Book {
  const switched = toLibraryBook(remote, chapters),
    currentIndex = chapters.length
      ? migrationChapterIndex(
          current.currentChapterIndex ?? 0,
          current.chapterTitle,
          chapters,
          current.chapters?.length ?? 0,
        )
      : 0,
    chapter = switched.chapters?.[currentIndex],
    previousChapter = current.chapters?.[current.currentChapterIndex ?? 0],
    position = current.readingPosition?.chapterId === previousChapter?.id
      ? current.readingPosition : undefined;
  const config: Partial<Book> = {};
  for (const key of [
    'reSegment',
    'deleteRubyTag',
    'deleteHeadingTag',
    'imageStyle',
    'removeDuplicateTitle',
    'removeDuplicateTitleChapterIds',
    'keepDuplicateTitleKeys',
    'manualReplaceRuleIds',
    'useReplaceRules',
    'reverseToc',
    'tocExpanded',
    'simulatedReading',
  ] as const)
    Object.assign(config, { [key]: current[key] });
  const sourceType = remote.sourceType ?? current.sourceType ?? 0;
  return {
    ...switched,
    ...config,
    id: current.id,
    groupIds: current.groupIds,
    order: current.order,
    canUpdate: current.canUpdate ?? true,
    customCoverUrl: current.customCoverUrl,
    persistedCoverUrl: current.persistedCoverUrl,
    customIntro: current.customIntro,
    customTag: current.customTag,
    kind: remote.kind,
    wordCount: remote.wordCount,
    sourceType,
    nativeType: nativeTypeForSource(sourceType),
    updateError: false,
    notShelf: false,
    durChapterTime: current.durChapterTime ?? current.updatedAt,
    latestChapterTime: switched.updatedAt,
    lastCheckCount: 0,
    latestChapterTitle: remote.latestChapterTitle ?? chapters.at(-1)?.title,
    progress: chapters.length ? current.progress : 0,
    currentChapterIndex: currentIndex,
    chapterTitle: chapter?.title ?? switched.chapterTitle,
    content: chapter?.content ?? '',
    ...(chapter && position
      ? { readingPosition: { ...position, chapterId: chapter.id } }
      : {}),
    updatedAt: Date.now(),
  };
}
