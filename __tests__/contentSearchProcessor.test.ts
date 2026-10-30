jest.mock('react-native-quick-crypto', () => require('crypto'));
jest.mock('../src/data/storage', () => ({ appStorage: { getString: jest.fn(), set: jest.fn(), remove: jest.fn() } }));
import type { Book } from '../src/types';
import { defaultReaderPreferences } from '../src/data/readerPreferences';
import { parseReplaceRules } from '../src/data/replaceRules';
import { prepareContentSearchChapter, runBookContentSearch } from '../src/core/contentSearchProcessor';
import { contentSearchPositions, contentSearchResult, contentSearchSnippetParts, locateContentSearchResult } from '../src/core/contentSearch';
import { chapterTitleRemovalKey } from '../src/core/chapterTitlePolicy';
import { convertChinese } from '../src/core/chineseConversion';
import native from './fixtures/contentSearch.native.json';

const book: Book = { id: 'book', name: '参考书', author: '', intro: '', chapterTitle: '第一章', content: '', progress: 0, updatedAt: 1, origin: '源' };
test('matches unchanged native search/getContent/title methods for positions, excerpts and ordinals', () => {
  const plans = native.plans.map(plan => plan.length ? parseReplaceRules(JSON.stringify(plan)) : []);
  for (const item of native.cases) {
    const chapter = { id: 'c', title: item.title, content: item.content };
    const mode = item.mode as 0 | 1 | 2;
    const prepared = item.content ? prepareContentSearchChapter({ ...book, name: item.bookName, reSegment: item.resegment,
      keepDuplicateTitleKeys: item.keepTitle ? [chapterTitleRemovalKey(0, convertChinese(item.title, mode))] : undefined,
    }, chapter, 0, { ...defaultReaderPreferences, chineseConverterType: mode, adaptSpecialStyle: item.adapt, paragraphIndent: item.indent }, plans[item.plan], item.replace && item.bookEnabled, () => 0.5) : undefined;
    const actual = prepared ? [...contentSearchPositions(prepared.content, item.query, item.regex)].map(({ start, end }, ordinal) => {
      const value = contentSearchResult(prepared.content, item.query, item.regex, start, end, { id: chapter.id, title: prepared.title }, 0, ordinal);
      return { ordinal: value.ordinal, start: value.start, queryIndexInResult: value.queryIndexInResult, excerpt: value.excerpt, chapterTitle: value.chapterTitle };
    }) : [];
    expect({ item, actual }).toEqual({ item, actual: item.expected.results });
  }
});

test('searches cached content only, retains all chapter hits and never mutates input records', async () => {
  const chapters = [{ id: 'one', title: '题', content: '甲'.repeat(125) }, { id: 'missing', title: '甲', content: '' }, { id: 'two', title: '二', content: '甲乙' }];
  const before = JSON.stringify(chapters), results: number[] = [];
  await runBookContentSearch({ book, chapters, query: '甲', regex: false, preferences: defaultReaderPreferences, rules: [], replaceEnabled: false, signal: new AbortController().signal,
    onChapter: items => results.push(items.length), yieldTask: async () => {},
  });
  expect(results).toEqual([125, 1]); expect(JSON.stringify(chapters)).toBe(before);
});

test('cancels a large in-progress chapter and keeps completed chapter batches', async () => {
  const controller = new AbortController(), counts: number[] = [];
  let yields = 0;
  await runBookContentSearch({ book, chapters: [{ id: 'one', title: '一', content: '甲' }, { id: 'two', title: '二', content: '甲'.repeat(600) }],
    query: '甲', regex: false, preferences: defaultReaderPreferences, rules: [], replaceEnabled: false, signal: controller.signal,
    onChapter: items => counts.push(items.length), yieldTask: async () => { if (++yields === 2) controller.abort(); },
  });
  expect(counts).toEqual([1]);
});

test('locates the occurrence ordinal in the current reader output rather than using old search offsets', () => {
  const result = contentSearchResult('old位置甲甲', '甲', false, 6, 7, { id: 'one', title: '题' }, 0, 1);
  expect(locateContentSearchResult('题', '　　甲长段。\n　　甲末尾。', result, '　　', false)).toBe(11);
  expect(locateContentSearchResult('题', '　　没有匹配', result, '　　', false)).toBe(0);
});

test('uses native snippet search-from-20 behavior without extending the excerpt', () => {
  expect(contentSearchSnippetParts({ excerpt: '甲'.repeat(41), query: '甲+', regex: true })).toEqual({ before: '甲'.repeat(20), match: '甲'.repeat(21), after: '' });
  expect(contentSearchSnippetParts({ excerpt: '甲', query: '甲', regex: true })).toEqual({ before: '甲', match: '', after: '' });
  expect(contentSearchSnippetParts({ excerpt: '甲甲', query: '甲', regex: false })).toEqual({ before: '', match: '甲', after: '甲' });
});
