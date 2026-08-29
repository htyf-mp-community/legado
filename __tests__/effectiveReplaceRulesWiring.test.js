const { readFileSync } = require('fs');
const { resolve } = require('path');

test('reader exposes actual replacement hits and opens the exact rule editor', () => {
  const source = readFileSync(resolve(__dirname, '../src/index.tsx'), 'utf8');
  expect(source).toContain('effectiveReplaceRuleHits(');
  expect(source).toContain("t('effectiveReplaceRules')");
  expect(source).toContain('effectiveRuleRows.map');
  expect(source).toContain('openReplaceRule(item.rule.id)');
  expect(source).toContain(
    "navigation.navigate('ReplaceRuleEditor', { ruleId })",
  );
  expect(source).toContain('if (focused) setReplaceRules(loadReplaceRules())');
});
