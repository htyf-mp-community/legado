const fs = require('fs');
const path = require('path');
test('wires the manager through React Navigation and rule editors through the shared toolbar', () => {
  const index = fs.readFileSync(path.join(__dirname, '../src/index.tsx'), 'utf8');
  expect(index).toContain('KeyboardAssists: undefined');
  expect(index).toContain('<Stack.Screen name="KeyboardAssists">');
  for (const file of ['SourceEditor.tsx', 'ReplaceRuleEditor.tsx', 'RssSourceManager.tsx'])
    expect(fs.readFileSync(path.join(__dirname, '../src/screens', file), 'utf8')).toContain('KeyboardAssistInput');
});
