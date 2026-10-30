jest.mock('react-native-quick-crypto', () => require('crypto'));
jest.mock('../src/data/storage', () => ({ appStorage: { getString: jest.fn(), set: jest.fn(), remove: jest.fn() } }));

import { chapterTitleRemovalKey, setChapterTitleRemoval } from '../src/core/chapterTitlePolicy';
import { processChapterTitle } from '../src/core/chapterTitle';
import native from './fixtures/chapterTitle.native.json';
import type { Book } from '../src/types';
import { applyReplaceRules, parseReplaceRules, replacementContextForBook } from '../src/data/replaceRules';

test('matches native chapter index/title-MD5 .nr identities', () => {
  for (const row of native.cases) {
    expect(chapterTitleRemovalKey(row.chapterIndex, row.title)).toBe(row.expected.key);
  }
});

test('defaults to removal and retains raw cached content when disabling and re-enabling a chapter', () => {
  const book: Book = {
    id: 'book', name: '测试书', author: '', intro: '', chapterTitle: '第一章',
    content: '【测试书】第一章\n正文', progress: 0, updatedAt: 1,
  };
  const key = chapterTitleRemovalKey(0, book.chapterTitle);
  const render = (value: Book) => processChapterTitle(value.content, {
    bookName: value.name, title: value.chapterTitle,
    skipRemoval: value.keepDuplicateTitleKeys?.includes(key),
  });
  expect(render(book)).toEqual({ content: '正文', removed: true });
  const kept = setChapterTitleRemoval(book, key, false);
  expect(render(kept)).toEqual({ content: book.content, removed: false });
  const restored = setChapterTitleRemoval(kept, key, true);
  expect(render(restored)).toEqual({ content: '正文', removed: true });
  expect(kept.content).toBe(book.content);
  expect(restored.content).toBe(book.content);
  expect(book.keepDuplicateTitleKeys).toBeUndefined();
});

test('one chapter exclusion does not suppress a different title or chapter index', () => {
  const original = '第一章\n正文';
  const key = chapterTitleRemovalKey(0, '第一章');
  expect(key).not.toBe(chapterTitleRemovalKey(1, '第一章'));
  expect(key).not.toBe(chapterTitleRemovalKey(0, '改名章节'));
  expect(processChapterTitle(original, { title: '第一章', bookName: '书', skipRemoval: false }).removed).toBe(true);
});

test('uses the native source scope for the replacement-title matching fallback', () => {
  const book = { name: '测试书', origin: 'https://books.example/source' };
  const rules = parseReplaceRules(JSON.stringify([{
    id: 1, name: '标题规则', pattern: '^第1章$', replacement: '第一章', isRegex: true,
    scopeTitle: true, scopeContent: false, scope: book.origin, isEnabled: true,
  }]));
  const displayTitle = applyReplaceRules('第1章', rules, 'title', replacementContextForBook(book));
  expect(displayTitle).toBe('第一章');
  expect(processChapterTitle('【测试书】第一章\n正文', {
    bookName: book.name, title: '第1章', displayTitle, replaceEnabled: true,
  })).toEqual({ content: '正文', removed: true });
  expect(replacementContextForBook({ name: '本地书', origin: 'local' }).origin).toBe('loc_book');
});
