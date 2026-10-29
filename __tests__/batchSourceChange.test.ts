import type { Book, BookChapter, SearchBook } from '../src/types';
import { applyBatchSourceChange } from '../src/core/batchSourceChange';
const before: Book = {
  id: 'old-id',
  name: 'Book',
  author: 'A',
  intro: '',
  chapterTitle: '第二章 远行',
  content: 'old cached text',
  origin: 'old',
  bookUrl: '/old',
  progress: 0.35,
  currentChapterIndex: 1,
  chapters: [
    { id: 'one', title: '第一章 初见', content: '' },
    { id: 'two', title: '第二章 远行', content: 'old cached text' },
  ],
  groupIds: ['1'],
  canUpdate: false,
  order: 9,
  durChapterTime: 6,
  updatedAt: 1,
  customCoverUrl: 'custom',
  persistedCoverUrl: 'persisted',
  customIntro: 'custom intro',
  customTag: 'custom tag',
  updateError: true,
  nativeType: 24,
  reverseToc: true,
  useReplaceRules: false,
  imageStyle: 'text',
};
const remote: SearchBook = {
  name: 'Book',
  author: 'A',
  intro: 'new info',
  origin: 'new',
  originName: 'New',
  bookUrl: '/new',
  sourceType: 0,
  kind: 'new kind',
  wordCount: '10万',
};
const chapters: BookChapter[] = Array.from({ length: 4 }, (_, index) => ({
  url: `/new/${index}`,
  title: index === 3 ? '第四章 远行' : `第${index + 1}章 别的章节`,
  index,
  bookUrl: '/new',
  baseUrl: '/toc',
  isVolume: false,
  isVip: false,
  isPay: false,
}));
test('migrates native position, private configuration and latest concurrent edits without using progress as a chapter ratio', () => {
  const latest = {
      ...before,
      progress: 0.8,
      groupIds: ['2'],
      order: 20,
      persistedCoverUrl: 'latest',
    },
    extra = { ...before, id: 'extra', name: 'Other', bookUrl: '/extra' };
  const result = applyBatchSourceChange(
    [latest, extra],
    before,
    remote,
    chapters,
  );
  expect(result.saved).toBe(true);
  expect(result.books).toHaveLength(2);
  expect(result.books[0]).toMatchObject({
    id: before.id,
    origin: 'new',
    bookUrl: '/new',
    currentChapterIndex: 3,
    chapterTitle: '第四章 远行',
    progress: 0.8,
    groupIds: ['2'],
    order: 20,
    canUpdate: false,
    durChapterTime: 6,
    customCoverUrl: 'custom',
    persistedCoverUrl: 'latest',
    customIntro: 'custom intro',
    customTag: 'custom tag',
    nativeType: 8,
    updateError: false,
    reverseToc: true,
    useReplaceRules: false,
    imageStyle: 'text',
    kind: 'new kind',
    wordCount: '10万',
    content: '',
  });
  expect(result.books[1]).toBe(extra);
});
test('native canReName insertion retains the old name/author record when neither unique key replaces it', () => {
  const result = applyBatchSourceChange(
    [before],
    before,
    { ...remote, name: 'Renamed' },
    chapters,
  );
  expect(result.books).toHaveLength(2);
  expect(result.books[0]).toBe(before);
  expect(result.books[1]).toMatchObject({
    name: 'Renamed',
    bookUrl: '/new',
    progress: before.progress,
    groupIds: ['1'],
  });
  expect(result.books[1].id).not.toBe(before.id);
});
test('Room replacement honors both target URL and unique name/author keys', () => {
  const urlOwner = {
      ...before,
      id: 'url-owner',
      name: 'URL owner',
      bookUrl: '/new',
    },
    titleOwner = {
      ...before,
      id: 'title-owner',
      name: 'Renamed',
      bookUrl: '/title-owner',
    };
  const result = applyBatchSourceChange(
    [before, urlOwner, titleOwner],
    before,
    { ...remote, name: 'Renamed' },
    chapters,
  );
  expect(result.books).toHaveLength(2);
  expect(result.books[0]).toBe(before);
  expect(result.books[1]).toMatchObject({
    id: 'url-owner',
    name: 'Renamed',
    bookUrl: '/new',
  });
});
test.each(['removed', 'other-source'])(
  'a %s selected identity cannot be recreated or overwritten by a delayed result',
  state => {
    const current =
      state === 'removed'
        ? []
        : [{ ...before, origin: 'chosen-elsewhere', bookUrl: '/elsewhere' }];
    expect(applyBatchSourceChange(current, before, remote, chapters)).toEqual({
      books: current,
      saved: false,
    });
  },
);
