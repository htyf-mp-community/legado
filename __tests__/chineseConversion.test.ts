jest.mock('../src/data/storage', () => ({
  appStorage: { getString: jest.fn(), set: jest.fn() },
}));
jest.mock('react-native-quick-crypto', () => require('crypto'));

import { normalizeReaderPreferences, saveReaderPreferences, loadReaderPreferences } from '../src/data/readerPreferences';
import { appStorage } from '../src/data/storage';
import {
  convertChinese,
  displayChapterTitle,
  type ChineseConverterType,
} from '../src/core/chineseConversion';
import { prepareReaderText } from '../src/core/readerText';
import { createHash } from 'react-native-quick-crypto';
import native from './fixtures/chineseConversion.native.json';
import {
  applyReplaceRules,
  normalizeReplaceRule,
} from '../src/data/replaceRules';

test('retains the source Chinese conversion mode instead of discarding the setting', () => {
  expect(
    normalizeReaderPreferences({ chineseConverterType: 2 })
      .chineseConverterType,
  ).toBe(2);
});

test('matches every original wrapper/JAR explicit result including exclusions and supplementary characters', () => {
  for (const row of native.explicitCases)
    expect(convertChinese(row.content, row.mode as ChineseConverterType)).toBe(
      row.expected,
    );
});

test('matches original JAR output for every dictionary key in bounded blocks', () => {
  const data = require('../src/data/chineseConversionData.json') as Record<
    's2t' | 't2s',
    { chars: string[][]; phrases: string[][] }
  >;
  const keys = {
    s2t: [...data.s2t.chars, ...data.s2t.phrases].map(pair => pair[0]),
    t2s: [...data.t2s.chars, ...data.t2s.phrases].map(pair => pair[0]),
  };
  const hash = (value: string) =>
    createHash('sha256').update(value).digest('hex');
  for (const row of native.dictionaryBlocks) {
    const input = keys[row.table as 's2t' | 't2s']
      .slice(row.start, row.start + row.count)
      .join('\0');
    expect(hash(input)).toBe(row.inputSha256);
    const output = convertChinese(input, row.mode as ChineseConverterType);
    expect(hash(output)).toBe(row.expectedSha256);
    expect(output.length).toBe(row.outputUtf16Units);
  }
});

test('normalizes off and both native modes without accepting invalid stored values', () => {
  for (const mode of [0, 1, 2] as const)
    expect(
      normalizeReaderPreferences({ chineseConverterType: mode })
        .chineseConverterType,
    ).toBe(mode);
  expect(normalizeReaderPreferences({}).chineseConverterType).toBe(0);
  expect(
    normalizeReaderPreferences({ chineseConverterType: 99 as never })
      .chineseConverterType,
  ).toBe(0);
  expect(convertChinese('原文“髮”\r\n😀', 0)).toBe('原文“髮”\r\n😀');
});

test('persists conversion through the existing reader-preference store', async () => {
  let saved: string | undefined;
  (appStorage.getString as jest.Mock).mockImplementation(() => saved);
  (appStorage.set as jest.Mock).mockImplementation((_key: string, value: string) => { saved = value; });
  await saveReaderPreferences(normalizeReaderPreferences({ chineseConverterType: 2 }));
  expect((await loadReaderPreferences()).chineseConverterType).toBe(2);
  await saveReaderPreferences(normalizeReaderPreferences({ chineseConverterType: 0 }));
  expect((await loadReaderPreferences()).chineseConverterType).toBe(0);
});

test('converts display title after removing CR/LF and before title replacement rules', () => {
  const context = { name: '书', origin: 'local' };
  const rules = [
    normalizeReplaceRule({
      id: 1,
      pattern: '^头发$',
      replacement: '标题净化',
      scopeTitle: true,
      isRegex: true,
    }),
  ];
  expect(
    displayChapterTitle('頭\r\n髮', 1, title =>
      applyReplaceRules(title, rules, 'title', context),
    ),
  ).toBe('标题净化');
  const remove = normalizeReplaceRule({
    pattern: '.*',
    replacement: '',
    scopeTitle: true,
    isRegex: true,
  });
  const next = normalizeReplaceRule({
    pattern: '头发',
    replacement: '仍有标题',
    scopeTitle: true,
    isRegex: false,
  });
  expect(
    displayChapterTitle('頭髮', 1, title =>
      applyReplaceRules(title, [remove, next], 'title', context),
    ),
  ).toBe('仍有标题');
});

test('runs resegmentation before conversion and bypasses the null sentinel', () => {
  for (const row of native.pipelineCases)
    expect(
      prepareReaderText(
        row.content,
        row.title,
        row.reSegment,
        row.mode as ChineseConverterType,
        () => 0.5,
      ),
    ).toBe(row.expected);
});
