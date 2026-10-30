jest.mock('react-native-mmkv', () => ({ createMMKV: () => ({ getString: jest.fn(), set: jest.fn() }) }));

import { applyReplaceRules, parseReplaceRules, runReplaceRules } from '../src/data/replaceRules';
import { sqliteLike } from '../src/core/sqliteLike';
import { readerReplacementPolicy, runReaderContentRules, trimReplacementLines } from '../src/core/readerReplacement';
import native from './fixtures/replaceRules.native.json';

const context = { name: 'iOS_a%', origin: 'https://EXAMPLE.com/' };
const rule = (patch: Record<string, unknown> = {}) => parseReplaceRules(JSON.stringify({
  id: 1, pattern: '(甲)', replacement: '<$0/$10>', order: 0, ...patch,
}))[0];

test('retains literal spaces and distinguishes empty exclusions from null', () => {
  expect(rule({ pattern: '  ', isRegex: false }).pattern).toBe('  ');
  expect(rule({ scope: ' ', excludeScope: '' })).toMatchObject({ scope: ' ', excludeScope: '' });
});

test('uses native SQL LIKE semantics for ASCII case, wildcard book names and source scope', () => {
  expect(applyReplaceRules('甲', [rule({ scope: 'https://example.com/' })], 'content', context)).toBe('<甲/甲0>');
  expect(applyReplaceRules('甲', [rule({ scope: 'prefix IOS😀abc suffix' })], 'content', context)).toBe('<甲/甲0>');
  expect(applyReplaceRules('甲', [rule({ scope: 'other', excludeScope: context.origin, scopeSource: true })], 'source', context)).toBe('<甲/甲0>');
});

test('uses Matcher replacement syntax and continues after an invalid per-rule replacement', () => {
  const rules = [rule({ replacement: '$&' }), rule({ id: 2, replacement: '\\$1/$0', order: 1 })];
  expect(applyReplaceRules('甲', rules, 'content', context)).toBe('$1/甲');
});

test('matches the original DAO queries executed by SQLite', () => {
  for (const item of native.scopeCases) {
    const candidate = rule({ ...item, id: 7, pattern: 'x', replacement: 'y', isRegex: false });
    const result = runReplaceRules('x', [candidate], item.target as 'content' | 'title' | 'source', item.context);
    expect({ item, ids: result.hits.map(hit => hit.id) }).toEqual({ item, ids: item.expectedIds });
  }
});

test('matches SQLite default LIKE including wildcards, ASCII folding, NUL and Unicode', () => {
  for (const item of native.likeCases) {
    expect({ item, result: sqliteLike(item.value, item.pattern) }).toEqual({ item, result: item.expected });
  }
});

test('matches JVM replacement strings, per-rule failures and blank title rollback', () => {
  for (const item of native.replacementCases) {
    const result = runReplaceRules(item.input, [rule({ ...item, scopeTitle: true })], item.title ? 'title' : 'content', context);
    const expected = item.expected as { value?: string; error?: string };
    expect({ item, value: result.value, failure: result.issues.length > 0 }).toEqual({
      item, value: expected.error ? item.input : expected.value, failure: !!expected.error,
    });
  }
});

test('matches the exact Kotlin line/whitespace stage', () => {
  for (const item of native.trimCases) {
    expect({ item, value: trimReplacementLines(item.input) }).toEqual({ item, value: item.expected.value });
  }
});

test('tracks changed rules in sequence and records failures without partial output', () => {
  const result = runReplaceRules('甲', [
    rule({ replacement: '$&' }), rule({ id: 2, replacement: '乙', order: 1 }),
    rule({ id: 3, pattern: '(乙)', replacement: '丙', order: 2 }),
    rule({ id: 4, pattern: '丙', replacement: '丙', order: 3 }),
  ], 'content', context);
  expect(result.value).toBe('丙');
  expect(result.hits.map(hit => hit.id)).toEqual([2, 3]);
  expect(result.issues.map(issue => [issue.rule.id, issue.code])).toEqual([[1, 'invalid-replacement']]);
});

test('reports a matched script as unsupported; leaves literal and unmatched script replacements alone', () => {
  const candidate = rule({ replacement: '@js:result.toUpperCase()' });
  expect(runReplaceRules('甲', [candidate], 'content', context).issues[0].code).toBe('unsupported-script');
  expect(runReplaceRules('乙', [candidate], 'content', context)).toEqual({ value: '乙', hits: [], issues: [] });
  expect(applyReplaceRules('甲', [{ ...candidate, isRegex: false, pattern: '甲' }], 'content', context)).toBe('@js:result.toUpperCase()');
});

test('separates automatic enablement, manual overrides and temporary preview', () => {
  const title = rule({ id: 1, scopeTitle: true, scopeContent: false, isEnabled: false, scope: 'other' });
  const body = rule({ id: 2 });
  expect(readerReplacementPolicy([], undefined, true, false)).toEqual({ enabled: true, contentEnabled: true, rules: [] });
  expect(readerReplacementPolicy([body], null, true, false).rules).toEqual([body]);
  expect(readerReplacementPolicy([body], undefined, true, true).enabled).toBe(false);
  expect(readerReplacementPolicy([body], undefined, false, true).rules).toEqual([body]);
  expect(readerReplacementPolicy([body], [], true, true).enabled).toBe(false);
  expect(readerReplacementPolicy([body], [2], false, true).enabled).toBe(false);
  const selected = readerReplacementPolicy([title, body], [1], false, false);
  expect(selected).toMatchObject({ enabled: true, contentEnabled: false, rules: [{ id: 1, isEnabled: true }] });
  expect(selected.rules[0].scope).toBeUndefined();
  expect(readerReplacementPolicy([rule({ scopeContent: false, scopeSource: true })], [1], true, false).enabled).toBe(false);
});

test('runs the whitespace stage with automatic empty rules, skips manual title-only and null content', () => {
  const input = '\u00a0甲\u00a0\r\n 乙\t';
  expect(runReaderContentRules(input, [], context, true).value).toBe('甲\n乙');
  expect(runReaderContentRules(input, [], context, false).value).toBe(input);
  expect(runReaderContentRules('null', [rule({ pattern: 'null', replacement: 'changed' })], context, true).value).toBe('null');
});
