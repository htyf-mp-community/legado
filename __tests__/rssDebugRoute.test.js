const fs = require('fs');
const path = require('path');

test('routes RSS source debugging through typed React Navigation', () => {
  const root = fs.readFileSync(
    path.join(__dirname, '../src/index.tsx'),
    'utf8',
  );
  const manager = fs.readFileSync(
    path.join(__dirname, '../src/screens/RssSourceManager.tsx'),
    'utf8',
  );
  const screen = fs.readFileSync(
    path.join(__dirname, '../src/screens/RssSourceDebug.tsx'),
    'utf8',
  );
  expect(root).toContain('RssSourceDebug: { sourceUrl: string }');
  expect(root).toContain(
    "navigation.navigate('RssSourceDebug', { sourceUrl })",
  );
  expect(manager).toContain('debug(source.sourceUrl)');
  expect(screen).toContain('<InTreeSheet');
  expect(screen).toContain('runRssSourceDebug');
});
