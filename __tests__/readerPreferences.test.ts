jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ getString: jest.fn(), set: jest.fn() }),
}));
import {
  defaultReaderPreferences,
  normalizeReaderPreferences,
  readerPalette,
} from '../src/data/readerPreferences';
describe('reader preferences', () => {
  test('uses defaults for invalid persisted data', () =>
    expect(
      normalizeReaderPreferences({
        fontSize: Number.NaN,
        lineHeight: Number.POSITIVE_INFINITY,
        theme: 'bad' as never,
      }),
    ).toEqual(defaultReaderPreferences));
  test('clamps typography to usable bounds', () => {
    expect(
      normalizeReaderPreferences({ fontSize: 2, lineHeight: 100 }),
    ).toMatchObject({ fontSize: 14, lineHeight: 60 });
    expect(
      normalizeReaderPreferences({ fontSize: 99, lineHeight: 2 }),
    ).toMatchObject({ fontSize: 36, lineHeight: 22 });
  });
  test('normalizes page animation modes', () => {
    expect(normalizeReaderPreferences({ pageAnimation: 'fade' })).toMatchObject(
      { pageAnimation: 'fade' },
    );
    expect(
      normalizeReaderPreferences({ pageAnimation: 'bad' as never }),
    ).toMatchObject({ pageAnimation: 'slide' });
  });
  test('normalizes manga auto-scroll preferences', () => {
    expect(
      normalizeReaderPreferences({
        mangaAutoScroll: true,
        mangaAutoScrollSpeed: 500,
      }),
    ).toMatchObject({ mangaAutoScroll: true, mangaAutoScrollSpeed: 120 });
    expect(
      normalizeReaderPreferences({
        mangaAutoScrollSpeed: 0,
        mangaTapScroll: false,
        mangaAutoNext: false,
        mangaFitScreen: true,
      }),
    ).toMatchObject({
      mangaAutoScrollSpeed: 5,
      mangaTapScroll: false,
      mangaAutoNext: false,
      mangaFitScreen: true,
    });
  });
  test('persists the volume-key paging preference', () => {
    expect(
      normalizeReaderPreferences({ volumeKeyPage: false }).volumeKeyPage,
    ).toBe(false);
    expect(normalizeReaderPreferences({}).volumeKeyPage).toBe(true);
  });
  test('normalizes paragraph typography and content insets', () =>
    expect(
      normalizeReaderPreferences({
        letterSpacing: 20,
        paragraphSpacing: -3,
        paragraphIndent: '123456789012345',
        contentInsetHorizontal: 100,
        contentInsetVertical: -2,
        textBold: true,
        textFullJustify: false,
        showBrightnessOverlay: false,
      }),
    ).toMatchObject({
      letterSpacing: 4,
      paragraphSpacing: 0,
      paragraphIndent: '123456789012',
      contentInsetHorizontal: 64,
      contentInsetVertical: 0,
      textBold: true,
      textFullJustify: false,
      showBrightnessOverlay: false,
    }));
  test('keeps Android defaults for text justification and the brightness overlay', () => {
    expect(normalizeReaderPreferences({})).toMatchObject({
      textFullJustify: true,
      selectText: true,
      showBrightnessOverlay: true,
    });
  });
  test('normalizes the Android text-selection default', () => {
    expect(normalizeReaderPreferences({}).selectText).toBe(true);
    expect(normalizeReaderPreferences({ selectText: false }).selectText).toBe(
      false,
    );
  });
  test('normalizes Android page swipe and edge-tap thresholds', () => {
    expect(normalizeReaderPreferences({})).toMatchObject({
      pageSwipeThreshold: 40,
      pageEdgeInset: 0,
    });
    expect(
      normalizeReaderPreferences({
        pageSwipeThreshold: 2,
        pageEdgeInset: 999,
      }),
    ).toMatchObject({ pageSwipeThreshold: 12, pageEdgeInset: 399 });
  });
  test('normalizes Android pull-to-bookmark preferences', () => {
    expect(normalizeReaderPreferences({})).toMatchObject({
      pullToToggleBookmark: false,
      pullBookmarkDistance: 48,
    });
    expect(
      normalizeReaderPreferences({
        pullToToggleBookmark: true,
        pullBookmarkDistance: 500,
      }),
    ).toMatchObject({
      pullToToggleBookmark: true,
      pullBookmarkDistance: 240,
    });
  });
  test('keeps Android two-finger replacement preview opt-in', () => {
    expect(normalizeReaderPreferences({}).twoFingerReplacePreview).toBe(false);
    expect(
      normalizeReaderPreferences({ twoFingerReplacePreview: true })
        .twoFingerReplacePreview,
    ).toBe(true);
  });
  test('keeps Android hidden-menu return-key blocking opt-in', () => {
    expect(normalizeReaderPreferences({}).disableReturnKey).toBe(false);
    expect(normalizeReaderPreferences({ disableReturnKey: true })).toMatchObject(
      { disableReturnKey: true },
    );
  });
  test('keeps Android special-content adaptation enabled by default', () => {
    expect(normalizeReaderPreferences({}).adaptSpecialStyle).toBe(true);
    expect(
      normalizeReaderPreferences({ adaptSpecialStyle: false }),
    ).toMatchObject({ adaptSpecialStyle: false });
  });
  test('keeps Android reader title-detail defaults', () => {
    expect(normalizeReaderPreferences({})).toMatchObject({
      showReaderTitleAddition: true,
      showReaderTitleChapterNameOnly: false,
    });
    expect(
      normalizeReaderPreferences({
        showReaderTitleAddition: false,
        showReaderTitleChapterNameOnly: true,
      }),
    ).toMatchObject({
      showReaderTitleAddition: false,
      showReaderTitleChapterNameOnly: true,
    });
  });
  test('normalizes Android page/chapter progress behavior', () => {
    expect(normalizeReaderPreferences({}).progressBarBehavior).toBe('page');
    expect(
      normalizeReaderPreferences({ progressBarBehavior: 'chapter' })
        .progressBarBehavior,
    ).toBe('chapter');
    expect(
      normalizeReaderPreferences({ progressBarBehavior: 'bad' as never })
        .progressBarBehavior,
    ).toBe('page');
  });
  test('keeps Android reader system-bar and menu-color defaults', () => {
    expect(normalizeReaderPreferences({})).toMatchObject({
      hideStatusBar: false,
      readerChromeFollowsPage: false,
    });
    expect(
      normalizeReaderPreferences({
        hideStatusBar: true,
        readerChromeFollowsPage: true,
      }),
    ).toMatchObject({
      hideStatusBar: true,
      readerChromeFollowsPage: true,
    });
  });
  test('normalizes reader mode, brightness and orientation', () => {
    expect(
      normalizeReaderPreferences({
        mode: 'page',
        brightness: 0,
        orientation: 'landscape',
      }),
    ).toMatchObject({
      mode: 'page',
      brightness: 0.15,
      orientation: 'landscape',
    });
  });
  test('normalizes Android dual-page modes', () => {
    expect(normalizeReaderPreferences({}).doublePageMode).toBe('single');
    expect(
      normalizeReaderPreferences({ doublePageMode: 'tabletLandscape' })
        .doublePageMode,
    ).toBe('tabletLandscape');
    expect(
      normalizeReaderPreferences({ doublePageMode: 'bad' as never })
        .doublePageMode,
    ).toBe('single');
  });
  test('normalizes Android body-image click modes', () => {
    expect(normalizeReaderPreferences({}).imageClickMode).toBe('default');
    expect(
      normalizeReaderPreferences({ imageClickMode: 'double' }).imageClickMode,
    ).toBe('double');
    expect(
      normalizeReaderPreferences({ imageClickMode: 'bad' as never })
        .imageClickMode,
    ).toBe('default');
  });
  test('normalizes Android highlight action triggers', () => {
    expect(normalizeReaderPreferences({}).highlightActionTrigger).toBe('click');
    expect(
      normalizeReaderPreferences({ highlightActionTrigger: 'longPress' })
        .highlightActionTrigger,
    ).toBe('longPress');
    expect(
      normalizeReaderPreferences({ highlightActionTrigger: 'off' })
        .highlightActionTrigger,
    ).toBe('off');
    expect(
      normalizeReaderPreferences({ highlightActionTrigger: 'bad' as never })
        .highlightActionTrigger,
    ).toBe('click');
  });
  test('provides readable theme pairs', () => {
    expect(readerPalette('paper')).toMatchObject({ background: '#f4ecd8' });
    expect(readerPalette('night')).toMatchObject({ foreground: '#c7c9c7' });
    expect(readerPalette('epaper')).toEqual({
      background: '#ffffff',
      foreground: '#000000',
      chrome: '#ffffff',
    });
    const custom = normalizeReaderPreferences({
      paperBackground: '#ABCDEF',
      paperForeground: '#123456',
    });
    expect(readerPalette('paper', custom)).toEqual({
      background: '#abcdef',
      foreground: '#123456',
      chrome: '#abcdef',
    });
    expect(
      normalizeReaderPreferences({ nightBackground: 'red' }).nightBackground,
    ).toBe('#171a1c');
  });
});
