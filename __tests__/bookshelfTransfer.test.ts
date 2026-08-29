import { exportBookshelfJson, mergeBookshelf, parseBookshelfJson } from '../src/core/bookshelfTransfer';
import type { Book } from '../src/types';

const book: Book = { id: 'one', name: 'Book', author: 'Author', intro: 'Intro', chapterTitle: 'Two', content: 'body', chapters: [{ id: '1', title: 'One', content: 'first' }, { id: '2', title: 'Two', content: 'body' }], currentChapterIndex: 1, progress: 0.5, updatedAt: 2, groupIds: ['g'] };

test('round-trips full HTYF books inside Android-compatible bookshelf JSON', () => {
  const raw = exportBookshelfJson([book]), parsed = JSON.parse(raw);
  expect(parsed[0]).toMatchObject({ bookUrl: 'one', durChapterTitle: 'Two', durChapterIndex: 1, group: 'g' });
  expect(parseBookshelfJson(raw)).toEqual([book]);
});

test('imports a legacy Android bookshelf array with safe defaults', () => {
  expect(parseBookshelfJson(JSON.stringify([{ bookUrl: 'remote', name: 'Legacy', author: 'A', durChapterTitle: 'Chapter 9', durChapterIndex: 8, durChapterPos: 0.8, origin: 'source', group: '1,2' }]))[0]).toMatchObject({ id: 'remote', name: 'Legacy', chapterTitle: 'Chapter 9', currentChapterIndex: 0, progress: 0.8, origin: 'source', groupIds: ['1', '2'] });
});

test('merges new books and confirmation-controlled duplicates', () => {
  const changed = { ...book, name: 'Changed' }, other = { ...book, id: 'two', name: 'Other' };
  expect(mergeBookshelf([book], [changed, other], false)).toMatchObject({ added: 1, replaced: 0, skipped: 1, books: [book, other] });
  expect(mergeBookshelf([book], [changed], true)).toMatchObject({ added: 0, replaced: 1, skipped: 0, books: [changed] });
});
