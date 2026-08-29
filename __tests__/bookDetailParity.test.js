const fs = require('node:fs');
const path = require('node:path');

test('keeps Android book-detail actions wired to typed app state', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../src/index.tsx'),
    'utf8',
  );
  const refresh = fs.readFileSync(
    path.join(__dirname, '../src/core/bookshelfRefresh.ts'),
    'utf8',
  );

  for (const marker of [
    'Share.share({',
    'Clipboard.setString(value)',
    "t('copyBookUrl')",
    "t('copyTocUrl')",
    "t('moveBookToTop')",
    'refreshBookMetadata(current, source)',
    'value={book.canUpdate !== false}',
    'visible={confirmClearCache}',
    "navigation.navigate('AppLogs')",
  ])
    expect(source).toContain(marker);
  expect(refresh).toContain('book.canUpdate !== false');
});
