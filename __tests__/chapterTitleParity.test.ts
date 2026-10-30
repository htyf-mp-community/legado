import { removeDuplicateChapterTitle } from '../src/core/readerAdvanced';
import { processChapterTitle } from '../src/core/chapterTitle';
import native from './fixtures/chapterTitle.native.json';

describe('native duplicate chapter title boundary', () => {
  test('matches every native matcher result and removal flag', () => {
    const failures = native.cases.flatMap((row, index) => {
      const result = processChapterTitle(row.content, row);
      return result.content === row.expected.content && result.removed === row.expected.removed
        ? [] : [{ index, row, result }];
    });
    expect(failures).toEqual([]);
  });
  test('keeps a real first paragraph that only matches after deleting chapter-label characters', () => {
    expect(removeDuplicateChapterTitle('十二\n正文', '第十二章')).toBe('十二\n正文');
  });
  test('removes the exact title line after the native book-name and punctuation prefix', () => {
    expect(removeDuplicateChapterTitle('【测试书】第一章\n正文', '第一章', '测试书')).toBe('正文');
  });
  test('preserves the whole first line when the title has extra words', () => {
    expect(removeDuplicateChapterTitle('第一章 补充标题\n正文', '第一章')).toBe('第一章 补充标题\n正文');
  });
});
