const { readFileSync } = require('fs');
const { resolve } = require('path');

test('reader renders persisted primary/more actions in configured order', () => {
  const root = readFileSync(resolve(__dirname, '../src/index.tsx'), 'utf8');
  const sheet = readFileSync(
    resolve(__dirname, '../src/components/ReaderMenuConfigSheet.tsx'),
    'utf8',
  );
  expect(root).toContain('useState(loadReaderMenuConfig)');
  expect(root).toContain('readerMenuConfig[readerMenuTier]');
  expect(root).toContain('.filter(readerMenuAvailable)');
  expect(root).toContain('runReaderMenuAction(key)');
  expect(root).toContain('saveReaderMenuConfig(value)');
  expect(root).toContain('book.reSegment');
  expect(sheet).toContain('moveReaderMenuItem(value, key, -1)');
  expect(sheet).toContain('setReaderMenuSection(');
});
