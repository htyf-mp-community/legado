const fs = require('fs');
const path = require('path');

test('routes source-manager searches with a typed single-source scope and auto-submits route queries', () => {
  const root = fs.readFileSync(
    path.join(__dirname, '../src/index.tsx'),
    'utf8',
  );
  const screen = fs.readFileSync(
    path.join(__dirname, '../src/screens/BookSearch.tsx'),
    'utf8',
  );
  const manager = fs.readFileSync(
    path.join(__dirname, '../src/screens/SourceManager.tsx'),
    'utf8',
  );
  const editor = fs.readFileSync(
    path.join(__dirname, '../src/screens/SourceEditor.tsx'),
    'utf8',
  );
  expect(root).toContain('Search: { query?: string; sourceUrl?: string }');
  expect(root).toContain("navigation.navigate('Search', { sourceUrl })");
  expect(screen).toContain('initialSourceUrl');
  expect(screen).toContain('submitRef.current(false)');
  expect(manager).toContain('search(source.bookSourceUrl)');
  expect(editor).toContain('commit(search)');
});
