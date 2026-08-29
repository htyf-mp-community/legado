const { readFileSync } = require('fs');
const { resolve } = require('path');

test('routes scheduled-task login through React Navigation', () => {
  const source = readFileSync(resolve(__dirname, '../src/index.tsx'), 'utf8');
  expect(source).toMatch(/SourceLogin:\s*\{\s*sourceUrl\?:\s*string;\s*rssSourceUrl\?:\s*string;\s*autoTaskId\?:\s*string;?\s*\}/);
  expect(source).toMatch(/navigate\('SourceLogin',\s*\{\s*autoTaskId:\s*taskId\s*\}\)/);
});
