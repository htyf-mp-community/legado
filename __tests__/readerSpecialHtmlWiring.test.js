const fs = require('fs');
const path = require('path');

const component = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'components', 'ReaderRichContent.tsx'),
  'utf8',
);
const reader = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'index.tsx'),
  'utf8',
);

test('rich HTML is rendered in-tree with dynamic height and link handoff', () => {
  expect(component).toContain("segment.type === 'html'");
  expect(component).toContain('<WebView');
  expect(component).toContain('scrollEnabled={needsInnerScroll}');
  expect(component).toContain('readerSpecialHtmlHeightScript');
  expect(component).toContain('onOpenLink(request.url)');
  expect(component).toContain('javaScriptCanOpenWindowsAutomatically={false}');
  expect(reader).toContain('specialHtmlPageHeight={Math.max(');
});

test('reader applies the persisted special-style preference before replacement', () => {
  expect(reader).toContain('applyReaderSpecialStylePreference(');
  expect(reader).toContain('protectReaderHtmlMarkers(');
  expect(reader).toContain('protectedReplaceContent.restore(');
  expect(reader).toContain('prefs.adaptSpecialStyle,');
});
