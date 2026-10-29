import type { Book, LocalChapter } from '../types';
const identity = (chapter: LocalChapter) => chapter.url || chapter.id;
const sameStructure = (before: LocalChapter[], next: LocalChapter[]) =>
  before.length === next.length &&
  before.every((chapter, index) => identity(chapter) === identity(next[index]));
/** Apply fields changed by a screen against its captured book, preserving newer unrelated writes. */
export function applyBookUpdate(
  current: Book,
  before: Book | undefined,
  next: Book,
): Book {
  if (!before) return next;
  if (before.origin !== next.origin || before.bookUrl !== next.bookUrl)
    return current.customCoverUrl === next.customCoverUrl &&
      current.persistedCoverUrl === next.persistedCoverUrl
      ? next
      : {
          ...next,
          customCoverUrl: current.customCoverUrl,
          persistedCoverUrl: current.persistedCoverUrl,
        };
  const patch: Partial<Book> = {};
  for (const key of Object.keys(next) as Array<keyof Book>) {
    if (!Object.is(next[key], before[key]))
      Object.assign(patch, { [key]: next[key] });
  }
  const sourceChanged =
    current.origin !== before.origin || current.bookUrl !== before.bookUrl;
  if (sourceChanged) {
    for (const key of [
      'chapters',
      'content',
      'chapterTitle',
      'currentChapterIndex',
      'progress',
      'updatedAt',
      'pendingCatalog',
      'readingPosition',
      'pendingReadingPosition',
      'latestChapterTime',
      'latestChapterTitle',
      'lastCheckCount',
      'coverUrl',
      'tocUrl',
    ] as const)
      delete patch[key];
    return { ...current, ...patch };
  }
  if (
    patch.chapters &&
    before.chapters &&
    sameStructure(before.chapters, patch.chapters)
  ) {
    const changes = new Map(
      patch.chapters.map((chapter, index) => {
        const old = before.chapters![index],
          fields: Partial<LocalChapter> = {};
        for (const key of Object.keys(chapter) as Array<keyof LocalChapter>)
          if (!Object.is(chapter[key], old[key]))
            Object.assign(fields, { [key]: chapter[key] });
        return [identity(chapter), fields];
      }),
    );
    patch.chapters = current.chapters?.map(chapter => ({
      ...chapter,
      ...changes.get(identity(chapter)),
    }));
  }
  const result = { ...current, ...patch };
  if (patch.currentChapterIndex !== undefined) {
    const wanted = (next.chapters ?? before.chapters)?.[
      patch.currentChapterIndex
    ];
    const mapped = wanted
      ? (result.chapters?.findIndex(
          chapter => identity(chapter) === identity(wanted),
        ) ?? -1)
      : -1;
    if (mapped >= 0) result.currentChapterIndex = mapped;
  }
  if (patch.chapters || patch.currentChapterIndex !== undefined) {
    const chapter = result.chapters?.[result.currentChapterIndex ?? 0];
    if (chapter) {
      result.chapterTitle = chapter.title;
      result.content = chapter.content;
    }
  } else if (current.currentChapterIndex !== before.currentChapterIndex) {
    // A delayed content callback must not change the currently displayed chapter after a newer jump.
    result.chapterTitle = current.chapterTitle;
    result.content = current.content;
  }
  // Cursor callbacks can finish after the same book navigates to another chapter.
  const activeChapter = result.chapters?.[result.currentChapterIndex ?? 0];
  if (
    patch.readingPosition &&
    activeChapter &&
    patch.readingPosition.chapterId !== activeChapter.id
  )
    result.readingPosition = current.readingPosition;
  return result;
}
