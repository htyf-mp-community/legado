const fs = require('node:fs');
const path = require('node:path');

test('wires Android-compatible text justification and brightness controls into both reader settings surfaces', () => {
  const root = path.join(__dirname, '..');
  const reader = fs.readFileSync(path.join(root, 'src/index.tsx'), 'utf8');
  const settings = fs.readFileSync(
    path.join(root, 'src/screens/ReaderSettings.tsx'),
    'utf8',
  );

  expect(reader).toContain(
    "textAlign: prefs.textFullJustify ? 'justify' : 'left'",
  );
  expect(reader).toContain('prefs.showBrightnessOverlay ?');
  expect(reader).toContain('readerTouchAction({');
  expect(reader).toContain('swipeThreshold: prefs.pageSwipeThreshold');
  expect(reader).toContain('edgeInset: prefs.pageEdgeInset');
  expect(reader).toContain('readerMenuTitle(');
  expect(reader).toContain('prefs.showReaderTitleAddition');
  expect(reader).toContain('prefs.showReaderTitleChapterNameOnly');
  expect(reader).toContain('readerProgressState(');
  expect(reader).toContain("prefs.progressBarBehavior === 'page'");
  expect(reader).toContain('setPendingChapterJump(target)');
  expect(reader).toContain('hidden={prefs.hideStatusBar}');
  expect(reader).toContain('readerChromeColors(');
  expect(reader).toContain('prefs.readerChromeFollowsPage');
  expect(reader).toContain("accessibilityLabel={t('textFullJustify')}");
  expect(reader).toContain('selectable={prefs.selectText}');
  expect(reader).toContain("accessibilityLabel={t('selectReaderText')}");
  expect(reader).toContain("accessibilityLabel={t('pullToToggleBookmark')}");
  expect(reader).toContain('pullBookmarkGesture({');
  expect(reader).toContain('readerPageColumns(');
  expect(reader).toContain('value + pageColumns');
  expect(reader).toContain('Array.from({ length: pageColumns }');
  expect(reader).toContain('<ReaderRichContent');
  expect(reader).toContain('imageClickMode={prefs.imageClickMode}');
  expect(reader).toContain('visible={!!previewReaderImage}');
  expect(reader).toContain('visible={!!pendingReaderLink}');
  expect(reader).toContain("t('openReaderLinkWarning')");
  expect(reader).toContain(
    'highlightActionTrigger={prefs.highlightActionTrigger}',
  );
  expect(reader).toContain('visible={!!activeHighlightRule}');
  expect(reader).toContain('openHighlightRules(ruleId)');
  expect(reader).toContain('saveHighlightRules(next)');
  expect(reader).toContain('applyReaderTagPreferences(');
  expect(reader).toContain('book.deleteRubyTag');
  expect(reader).toContain('book.deleteHeadingTag');
  expect(reader).toContain('imageStyle={book.imageStyle}');
  expect(reader).toContain("t('readerImageStyleSingle')");
  expect(reader).toContain("accessibilityLabel={t('showBrightnessOverlay')}");
  expect(settings).toContain("label={t('textFullJustify')}");
  expect(settings).toContain("label={t('selectReaderText')}");
  expect(settings).toContain("t('textSelectionMenuConfig')");
  expect(settings).toContain("t('textSelectionMenuUnavailable')");
  expect(settings).toContain('accessibilityRole="summary"');
  expect(settings).toContain("label={t('pullToToggleBookmark')}");
  expect(settings).toContain("label={t('pullBookmarkDistance')}");
  expect(settings).toContain("t('doublePageMode')");
  expect(settings).toContain(
    "['tabletLandscape', t('tabletLandscapeDoublePage')]",
  );
  expect(settings).toContain("t('readerImageClickMode')");
  expect(settings).toContain("['double', t('imageClickDouble')]");
  expect(settings).toContain("t('highlightActionTrigger')");
  expect(settings).toContain("['click', t('highlightTriggerClick')]");
  expect(settings).toContain("['longPress', t('highlightTriggerLongPress')]");
  expect(settings).toContain("['off', t('highlightTriggerOff')]");
  expect(settings).toContain("label={t('showBrightnessOverlay')}");
  expect(settings).toContain("label={t('pageSwipeThreshold')}");
  expect(settings).toContain("label={t('pageEdgeInset')}");
  expect(settings).toContain("label={t('showReaderTitleAddition')}");
  expect(settings).toContain("label={t('showReaderTitleChapterNameOnly')}");
  expect(settings).toContain("t('readerProgressBehavior')");
  expect(settings).toContain("['chapter', t('progressByChapter')]");
  expect(settings).toContain("label={t('hideReaderStatusBar')}");
  expect(settings).toContain("label={t('readerChromeFollowsPage')}");
});
