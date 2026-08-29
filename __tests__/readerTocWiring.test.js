const { readFileSync } = require('fs');
const { resolve } = require('path');

test('reader toc wires search, persisted cleanup and identity-safe reversal', () => {
  const source = readFileSync(resolve(__dirname, '../src/index.tsx'), 'utf8');
  expect(source).toContain('readerTocEntries(');
  expect(source).toContain('tocQuery,');
  expect(source).toContain('reverseBookToc(book, index)');
  expect(source).toContain('tocUiUseReplace: next');
  expect(source).toContain('tocCountWords: next');
  expect(source).toContain('defaultCollapsedVolumeIds(');
  expect(source).toContain('chapterWordCount(item)');
  expect(source).toContain('setTocTab(tab)');
  expect(source).toContain('readerBookmarkTarget(');
  expect(source).toContain('position: pageIndex * pageCapacity');
  expect(source).toContain('setEditingBookmark(item)');
  expect(source).toContain("['toc', 'bookmarks', 'highlights']");
  expect(source).toContain('readerHighlightTarget(');
  expect(source).toContain('setEditingHighlight(item)');
  expect(source).toContain('setHighlights(listHighlights(book.id))');
  expect(source).toContain('saveHighlight({');
  expect(source).toContain("t('noTocMatches')");
});
