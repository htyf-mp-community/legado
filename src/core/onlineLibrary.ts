import type { Book, BookChapter, SearchBook } from '../types';
import { migrationChapterIndex } from './chapterMigration';

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
    currentIndex = chapters.length
      ? migrationChapterIndex(
          current.currentChapterIndex ?? 0,
          current.chapterTitle,
          chapters,
          current.chapters?.length ?? 0,
        )
      : 0,
    chapter = switched.chapters?.[currentIndex];
  const config: Partial<Book> = {};
  for (const key of [
    'reSegment',
    'deleteRubyTag',
    'deleteHeadingTag',
    'imageStyle',
    'removeDuplicateTitle',
    'removeDuplicateTitleChapterIds',
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
    nativeType: [8, 32, 64, 128, 4][sourceType] ?? 8,
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
    updatedAt: Date.now(),
  };
}
