import {
  chapterWordCount,
  collapsedVolumeIds,
  filterReaderBookmarks,
  filterReaderHighlights,
  readerTocEntries,
  readableChapterIndex,
  readerBookmarkTarget,
  readerHighlightTarget,
  reverseBookToc,
} from '../src/core/readerToc';
import type { Book, Highlight, LocalChapter } from '../src/types';

const chapters: LocalChapter[] = [
  { id: 'a', title: '正文 第一章', content: 'A' },
  { id: 'b', title: '正文 第二章', content: 'B' },
  { id: 'c', title: '番外', content: 'C' },
];

test('filters by raw or cleaned title while preserving original indexes', () => {
  expect(
    readerTocEntries(chapters, '第二', chapter =>
      chapter.title.replace('正文 ', ''),
    ),
  ).toEqual([
    expect.objectContaining({
      chapter: chapters[1],
      index: 1,
      title: '第二章',
    }),
  ]);
  expect(
    readerTocEntries(chapters, '正文', chapter => chapter.title.slice(3)),
  ).toHaveLength(2);
});

test('filters reader bookmarks and restores chapter plus character position', () => {
  const bookmarks = [
    {
      id: 'one',
      bookId: 'book',
      chapterId: 'b',
      chapterTitle: '正文 第二章',
      position: 240,
      excerpt: '关键段落',
      createdAt: 1,
    },
  ];
  expect(filterReaderBookmarks(bookmarks, '关键')).toEqual(bookmarks);
  expect(filterReaderBookmarks(bookmarks, '第一章')).toEqual([]);
  expect(readerBookmarkTarget(chapters, bookmarks[0], 100)).toEqual({
    chapterIndex: 1,
    pageIndex: 2,
  });
  expect(
    readerBookmarkTarget(
      chapters,
      { ...bookmarks[0], chapterId: 'missing' },
      100,
    ),
  ).toBeUndefined();
});

test('filters reader highlights and restores their exact chapter page', () => {
  const highlights: Highlight[] = [
    {
      id: 'highlight-one',
      bookId: 'book',
      chapterId: 'b',
      start: 240,
      end: 248,
      text: '关键原文',
      note: '阅读批注',
      color: '#f2d35b',
      createdAt: 1,
    },
  ];
  expect(filterReaderHighlights(highlights, '原文')).toEqual(highlights);
  expect(filterReaderHighlights(highlights, '批注')).toEqual(highlights);
  expect(filterReaderHighlights(highlights, '无匹配')).toEqual([]);
  expect(readerHighlightTarget(chapters, highlights[0], 100)).toEqual({
    chapterIndex: 1,
    pageIndex: 2,
  });
  expect(
    readerHighlightTarget(
      chapters,
      { ...highlights[0], chapterId: 'missing' },
      100,
    ),
  ).toBeUndefined();
});

test('groups volumes, collapses non-current groups and expands matches', () => {
  const grouped: LocalChapter[] = [
    { id: 'v1', title: '第一卷', content: '', isVolume: true },
    { id: 'a', title: '第一章', content: '一 二' },
    { id: 'v2', title: '第二卷', content: '', isVolume: true },
    { id: 'b', title: '第二章', content: '' },
  ];
  const collapsed = collapsedVolumeIds(grouped, 1, false);
  expect([...collapsed]).toEqual(['v2']);
  expect(
    readerTocEntries(grouped, '', chapter => chapter.title, {
      collapsedVolumeIds: collapsed,
    }).map(entry => entry.chapter.id),
  ).toEqual(['v1', 'a', 'v2']);
  expect(
    readerTocEntries(grouped, '第二章', chapter => chapter.title, {
      collapsedVolumeIds: collapsed,
    }).map(entry => entry.chapter.id),
  ).toEqual(['v2', 'b']);
  expect(chapterWordCount(grouped[1])).toBe('2');
  expect(chapterWordCount({ ...grouped[1], wordCount: '12K' })).toBe('12K');
  expect(readableChapterIndex(grouped, 0, 1)).toBe(1);
  expect(readableChapterIndex(grouped, 2, -1)).toBe(1);
});

test('reverses the stored toc and keeps the same current chapter selected', () => {
  const book: Book = {
    id: 'book',
    name: '书',
    author: '',
    intro: '',
    chapterTitle: '正文 第二章',
    content: 'B',
    chapters,
    currentChapterIndex: 1,
    progress: 2 / 3,
    updatedAt: 1,
  };
  const reversed = reverseBookToc(book, 1);
  expect(reversed.chapters?.map(chapter => chapter.id)).toEqual([
    'c',
    'b',
    'a',
  ]);
  expect(reversed).toMatchObject({
    currentChapterIndex: 1,
    chapterTitle: '正文 第二章',
    content: 'B',
    reverseToc: true,
  });
  expect(
    reverseBookToc(reversed, 1).chapters?.map(chapter => chapter.id),
  ).toEqual(['a', 'b', 'c']);
});
