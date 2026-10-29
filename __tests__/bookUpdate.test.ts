import { applyBookUpdate } from '../src/core/bookUpdate';
import type { Book } from '../src/types';
const chapter = (id: string, content = '') => ({
  id,
  url: `/${id}`,
  title: id,
  content,
});
const before: Book = {
  id: 'book',
  name: 'Book',
  author: 'A',
  intro: '',
  origin: 'source',
  bookUrl: '/book',
  chapterTitle: 'one',
  content: '',
  chapters: [chapter('one'), chapter('two')],
  currentChapterIndex: 0,
  progress: 0,
  updatedAt: 1,
  groupIds: ['1'],
  canUpdate: true,
};
test('late progress saves preserve a newly hydrated catalogue and concurrent metadata changes', () => {
  const pending = {
    ...before,
    chapters: [],
    chapterTitle: '',
    pendingCatalog: true,
  };
  const current = {
    ...before,
    groupIds: ['2'],
    canUpdate: false,
    pendingCatalog: false,
  };
  const result = applyBookUpdate(current, pending, {
    ...pending,
    progress: 0.25,
  });
  expect(result).toMatchObject({
    groupIds: ['2'],
    canUpdate: false,
    pendingCatalog: false,
    chapters: before.chapters,
    progress: 0.25,
    chapterTitle: 'one',
  });
});
test('a delayed chapter fetch caches its chapter without rolling back a later chapter jump or fresh catalogue entries', () => {
  const current = {
    ...before,
    chapters: [
      chapter('inserted'),
      chapter('one'),
      chapter('two', 'Current text'),
    ],
    currentChapterIndex: 2,
    chapterTitle: 'two',
    content: 'Current text',
    progress: 0.5,
  };
  const result = applyBookUpdate(current, before, {
    ...before,
    chapters: [chapter('one', 'Fetched text'), chapter('two')],
    content: 'Fetched text',
  });
  expect(result.chapters?.map(value => value.id)).toEqual([
    'inserted',
    'one',
    'two',
  ]);
  expect(result.chapters?.[1].content).toBe('Fetched text');
  expect(result).toMatchObject({
    currentChapterIndex: 2,
    chapterTitle: 'two',
    content: 'Current text',
    progress: 0.5,
  });
});
test('a requested chapter index maps by identity after newer insertions', () => {
  const current = {
    ...before,
    chapters: [chapter('inserted'), ...before.chapters!],
  };
  const result = applyBookUpdate(current, before, {
    ...before,
    currentChapterIndex: 1,
    chapterTitle: 'two',
  });
  expect(result.currentChapterIndex).toBe(2);
  expect(result.chapterTitle).toBe('two');
});
test('old-source callbacks cannot overwrite the current source catalogue; explicit source changes retain replacement semantics', () => {
  const current = {
    ...before,
    origin: 'new-source',
    bookUrl: '/new',
    chapters: [chapter('new')],
    chapterTitle: 'new',
  };
  expect(
    applyBookUpdate(current, before, {
      ...before,
      chapters: [chapter('one', 'Old-source text')],
      progress: 0.9,
    }),
  ).toMatchObject({
    origin: 'new-source',
    chapters: current.chapters,
    progress: 0,
  });
  const explicit = {
    ...before,
    origin: 'chosen-source',
    bookUrl: '/chosen',
    chapters: [chapter('chosen')],
  };
  expect(applyBookUpdate(current, before, explicit)).toBe(explicit);
});

test('an old chapter cursor flushed after a same-book chapter jump cannot replace the destination cursor', () => {
  const current = {
    ...before,
    currentChapterIndex: 1,
    readingPosition: { chapterId: 'two', position: 420 },
  };
  const result = applyBookUpdate(current, before, {
    ...before,
    readingPosition: { chapterId: 'one', position: 31 },
  });
  expect(result.currentChapterIndex).toBe(1);
  expect(result.readingPosition).toEqual(current.readingPosition);
});
test('an old-source cursor cannot replace a newer source cursor', () => {
  const current = {
    ...before,
    origin: 'new-source',
    bookUrl: '/new',
    chapters: [chapter('new')],
    readingPosition: { chapterId: 'new', position: 92 },
  };
  expect(
    applyBookUpdate(current, before, {
      ...before,
      readingPosition: { chapterId: 'one', position: 31 },
    }).readingPosition,
  ).toEqual(current.readingPosition);
});
