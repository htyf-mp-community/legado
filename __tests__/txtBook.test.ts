jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ getString: jest.fn(), set: jest.fn() }),
}));

import { createTxtBook, splitTxtChapters } from '../src/core/txtBook';
import {
  defaultTxtTocRules,
  mergeTxtTocRules,
  parseTxtTocRules,
} from '../src/data/txtTocRules';

test('splits Chinese TXT chapters and preserves preamble', () => {
  const chapters = splitTxtChapters(
    '作品简介\n这是简介\n第一章 开始\n正文一\n第二章 后续\n正文二',
    defaultTxtTocRules,
  );
  expect(chapters.map(chapter => chapter.title)).toEqual([
    '正文开始',
    '第一章 开始',
    '第二章 后续',
  ]);
  expect(chapters.map(chapter => chapter.content).join('\n')).toContain(
    '正文二',
  );
});

test('falls back to a single chapter when no rule matches', () => {
  expect(splitTxtChapters('没有章节标题', defaultTxtTocRules)).toEqual([
    { id: 'chapter-0', title: '正文', content: '没有章节标题' },
  ]);
});

test('creates a readable local book model', () => {
  expect(
    createTxtBook(
      'file:///novel.txt',
      '小说.txt',
      '第一章\n内容',
      defaultTxtTocRules,
    ),
  ).toMatchObject({
    id: 'local:file%3A%2F%2F%2Fnovel.txt',
    name: '小说',
    author: '本地导入',
    chapterTitle: '第一章',
  });
});

test('imports, validates and overwrites TXT rules by id', () => {
  const incoming = parseTxtTocRules(
    '[{"id":1,"name":"自定义","rule":"^卷\\\\d+$","replacement":"$&"}]',
  );
  expect(mergeTxtTocRules(defaultTxtTocRules, incoming)[0].name).toBe('自定义');
  expect(() => parseTxtTocRules('[{"name":"bad","rule":"("}]')).toThrow('正则');
});
