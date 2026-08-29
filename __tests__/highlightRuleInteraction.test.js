const fs = require('node:fs');
const path = require('node:path');

test('routes a selected highlight rule directly into its editor', () => {
  const root = path.join(__dirname, '..');
  const manager = fs.readFileSync(
    path.join(root, 'src/screens/HighlightRuleManager.tsx'),
    'utf8',
  );
  const highlighted = fs.readFileSync(
    path.join(root, 'src/components/RuleHighlightedText.tsx'),
    'utf8',
  );

  expect(manager).toContain('initialRuleId?: number');
  expect(manager).toContain('rule.id === initialRuleId');
  expect(manager).toContain('setEditing({ ...selected })');
  expect(highlighted).toContain("highlightActionTrigger === 'click'");
  expect(highlighted).toContain("highlightActionTrigger === 'longPress'");
  expect(highlighted).toContain('ruleId === undefined');
});
