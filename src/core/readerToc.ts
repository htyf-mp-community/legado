import type { Book, Bookmark, Highlight, LocalChapter } from '../types';

export type ReaderTocEntry = {
  chapter: LocalChapter;
  index: number;
  title: string;
  depth: number;
  isVolume: boolean;
  collapsed?: boolean;
  chapterCount?: number;
};

type TocGroup = { volume?: ReaderTocEntry; chapters: ReaderTocEntry[] };

function tocGroups(entries: ReaderTocEntry[], reverseOrder: boolean) {
  const groups: TocGroup[] = [];
  let volume: ReaderTocEntry | undefined,
    chapters: ReaderTocEntry[] = [];
  const flush = () => {
    if (volume || chapters.length) groups.push({ volume, chapters });
  };
  if (!reverseOrder) {
    for (const entry of entries) {
      if (entry.isVolume) {
        flush();
        volume = entry;
        chapters = [];
      } else chapters.push(entry);
    }
    flush();
    return groups;
  }
  for (const entry of entries) {
    if (entry.isVolume) {
      groups.push({ volume: entry, chapters });
      chapters = [];
    } else chapters.push(entry);
  }
  if (chapters.length) groups.push({ chapters });
  return groups;
}

export function readerTocEntries(
  chapters: LocalChapter[],
  query: string,
  displayTitle: (chapter: LocalChapter) => string,
  options: {
    collapsedVolumeIds?: ReadonlySet<string>;
    reverseOrder?: boolean;
  } = {},
): ReaderTocEntry[] {
  const needle = query.trim().toLocaleLowerCase(),
    entries = chapters.map((chapter, index) => ({
      chapter,
      index,
      title: displayTitle(chapter),
      depth: 0,
      isVolume: chapter.isVolume === true,
    }));
  return tocGroups(entries, options.reverseOrder === true).flatMap(group => {
    const matchedChapters = group.chapters.filter(
        entry =>
          !needle ||
          entry.title.toLocaleLowerCase().includes(needle) ||
          entry.chapter.title.toLocaleLowerCase().includes(needle),
      ),
      volumeMatched =
        !!group.volume &&
        (!needle ||
          group.volume.title.toLocaleLowerCase().includes(needle) ||
          group.volume.chapter.title.toLocaleLowerCase().includes(needle));
    if (needle && !volumeMatched && !matchedChapters.length) return [];
    if (!group.volume) return matchedChapters;
    const collapsed =
      !needle && options.collapsedVolumeIds?.has(group.volume.chapter.id);
    return [
      { ...group.volume, collapsed, chapterCount: group.chapters.length },
      ...(collapsed
        ? []
        : matchedChapters.map(entry => ({ ...entry, depth: 1 }))),
    ];
  });
}

export function collapsedVolumeIds(
  chapters: LocalChapter[],
  currentIndex: number,
  expanded: boolean,
  reverseOrder = false,
): Set<string> {
  if (expanded) return new Set();
  const entries = chapters.map((chapter, index) => ({
      chapter,
      index,
      title: chapter.title,
      depth: 0,
      isVolume: chapter.isVolume === true,
    })),
    groups = tocGroups(entries, reverseOrder),
    currentVolume = groups.find(group =>
      group.chapters.some(entry => entry.index === currentIndex),
    )?.volume?.chapter.id;
  return new Set(
    groups
      .filter(
        group => group.volume && group.volume.chapter.id !== currentVolume,
      )
      .map(group => group.volume!.chapter.id),
  );
}

export function chapterWordCount(chapter: LocalChapter) {
  if (chapter.wordCount?.trim()) return chapter.wordCount.trim();
  if (!chapter.content) return '';
  return String(chapter.content.replace(/\s/gu, '').length);
}

export function readableChapterIndex(
  chapters: LocalChapter[],
  requestedIndex: number,
  direction: -1 | 0 | 1 = 0,
) {
  if (!chapters.length) return 0;
  const safe = Math.max(0, Math.min(requestedIndex, chapters.length - 1));
  if (!chapters[safe].isVolume) return safe;
  const scan = (step: -1 | 1) => {
    for (
      let index = safe + step;
      index >= 0 && index < chapters.length;
      index += step
    )
      if (!chapters[index].isVolume) return index;
    return -1;
  };
  if (direction) {
    const directed = scan(direction);
    if (directed >= 0) return directed;
    const opposite = scan(direction === 1 ? -1 : 1);
    return opposite >= 0 ? opposite : safe;
  }
  const forward = scan(1);
  if (forward >= 0) return forward;
  const backward = scan(-1);
  return backward >= 0 ? backward : safe;
}

export function filterReaderBookmarks(bookmarks: Bookmark[], query: string) {
  const needle = query.trim().toLocaleLowerCase();
  return needle
    ? bookmarks.filter(bookmark =>
        `${bookmark.chapterTitle}\n${bookmark.excerpt}`
          .toLocaleLowerCase()
          .includes(needle),
      )
    : bookmarks;
}

export function readerBookmarkTarget(
  chapters: LocalChapter[],
  bookmark: Bookmark,
  pageCapacity: number,
) {
  const index = chapters.findIndex(
    chapter => chapter.id === bookmark.chapterId,
  );
  if (index < 0) return undefined;
  return {
    chapterIndex: readableChapterIndex(chapters, index),
    pageIndex: Math.max(
      0,
      Math.floor(bookmark.position / Math.max(1, pageCapacity)),
    ),
  };
}

export function filterReaderHighlights(highlights: Highlight[], query: string) {
  const needle = query.trim().toLocaleLowerCase();
  return needle
    ? highlights.filter(highlight =>
        `${highlight.text}\n${highlight.note ?? ''}`
          .toLocaleLowerCase()
          .includes(needle),
      )
    : highlights;
}

export function readerHighlightTarget(
  chapters: LocalChapter[],
  highlight: Highlight,
  pageCapacity: number,
) {
  const index = chapters.findIndex(
    chapter => chapter.id === highlight.chapterId,
  );
  if (index < 0) return undefined;
  return {
    chapterIndex: readableChapterIndex(chapters, index),
    pageIndex: Math.max(
      0,
      Math.floor(highlight.start / Math.max(1, pageCapacity)),
    ),
  };
}

export function reverseBookToc(book: Book, currentIndex: number): Book {
  const chapters = book.chapters ?? [];
  if (chapters.length < 2) return { ...book, reverseToc: !book.reverseToc };
  const safeIndex = Math.max(0, Math.min(currentIndex, chapters.length - 1)),
    current = chapters[safeIndex],
    reversed = [...chapters].reverse(),
    nextIndex = reversed.findIndex(chapter => chapter.id === current.id);
  return {
    ...book,
    chapters: reversed,
    reverseToc: !book.reverseToc,
    currentChapterIndex: nextIndex,
    chapterTitle: current.title,
    content: current.content,
    progress: (nextIndex + 1) / reversed.length,
    updatedAt: Date.now(),
  };
}
