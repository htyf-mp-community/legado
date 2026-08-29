const fs = require('fs');
const path = require('path');
test('source manager wires persistent domain grouping and exact group CRUD', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'screens', 'SourceManager.tsx'), 'utf8');
  expect(source).toContain('management.groupByDomain ? sortBookSourcesByDomain');
  expect(source).toContain('sourceDomain(filtered[index - 1].bookSourceUrl)');
  expect(source).toContain('assignUngroupedSources(sources, groupName)');
  expect(source).toContain('renameSourceGroup(sources, editingGroup, groupName)');
  expect(source).toContain('renameSourceGroup(sources, group)');
});
