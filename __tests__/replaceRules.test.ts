jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ getString: jest.fn(), set: jest.fn() }),
}));

import {
  applyReplaceRules,
  effectiveReplaceRuleHits,
  mergeReplaceRules,
  parseReplaceRules,
} from '../src/data/replaceRules';

test('imports current and legacy replacement rule fields', () => {
  const [rule] = parseReplaceRules(
    '[{"id":1,"replaceSummary":"净化","regex":"广告+","replacement":"","isRegex":true,"useTo":"书名","enable":true,"serialNumber":2}]',
  );
  expect(rule).toMatchObject({
    id: 1,
    name: '净化',
    pattern: '广告+',
    scope: '书名',
    isEnabled: true,
    order: 2,
  });
});

test('applies enabled rules in order with target and scope filtering', () => {
  const rules = parseReplaceRules(
    JSON.stringify([
      {
        id: 1,
        name: 'regex',
        pattern: '广[告吿]',
        replacement: '',
        isRegex: true,
        scopeContent: true,
        order: 1,
      },
      {
        id: 2,
        name: 'literal',
        pattern: '章节',
        replacement: '章',
        isRegex: false,
        scopeContent: true,
        scope: '目标书',
        order: 2,
      },
    ]),
  );
  expect(
    applyReplaceRules('广告章节', rules, 'content', {
      name: '目标书',
      origin: 'source',
    }),
  ).toBe('章');
  expect(
    applyReplaceRules('广告章节', rules, 'title', {
      name: '目标书',
      origin: 'source',
    }),
  ).toBe('广告章节');
  expect(
    effectiveReplaceRuleHits('广告章节', rules, 'content', {
      name: '目标书',
      origin: 'source',
    }).map(rule => rule.name),
  ).toEqual(['regex', 'literal']);
  expect(
    effectiveReplaceRuleHits('没有命中', rules, 'content', {
      name: '目标书',
      origin: 'source',
    }),
  ).toEqual([]);
});

test('honors exclusion scope and overwrites rules by id', () => {
  const [rule] = parseReplaceRules(
    '[{"id":1,"name":"A","pattern":"x","replacement":"y","isRegex":false,"excludeScope":"跳过"}]',
  );
  expect(
    applyReplaceRules('x', [rule], 'content', {
      name: '跳过这本书',
      origin: '',
    }),
  ).toBe('x');
  expect(mergeReplaceRules([rule], [{ ...rule, name: 'B' }])[0].name).toBe('B');
});

test('rejects empty and invalid regex patterns', () => {
  expect(() => parseReplaceRules('[{"name":"bad"}]')).toThrow('匹配内容');
  expect(() => parseReplaceRules('[{"pattern":"(","isRegex":true}]')).toThrow(
    '正则表达式',
  );
});

test('uses Android defaults for current-format rules', () => {
  expect(parseReplaceRules('[{"pattern":"text"}]')[0]).toMatchObject({
    isRegex: true,
    isEnabled: true,
    scopeContent: true,
  });
});
