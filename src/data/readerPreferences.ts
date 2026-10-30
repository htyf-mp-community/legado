import { appStorage } from './storage';
import type { ChineseConverterType } from '../core/chineseConversion';
const KEY = 'reader.preferences.v1';
export type ReaderTheme = 'paper' | 'green' | 'night' | 'epaper';
export type ReaderMode = 'scroll' | 'page';
export type ReaderOrientation = 'auto' | 'portrait' | 'landscape';
export type PageAnimation = 'none' | 'slide' | 'cover' | 'fade';
export type ReaderProgressBehavior = 'page' | 'chapter';
export type ReaderDoublePageMode =
  | 'single'
  | 'double'
  | 'landscape'
  | 'tabletLandscape';
export type ReaderImageClickMode =
  | 'default'
  | 'preview'
  | 'compat'
  | 'disabled'
  | 'double';
export type HighlightActionTrigger = 'click' | 'longPress' | 'off';
export type ReaderPreferences = {
  chineseConverterType: ChineseConverterType;
  fontSize: number;
  lineHeight: number;
  theme: ReaderTheme;
  mode: ReaderMode;
  doublePageMode: ReaderDoublePageMode;
  imageClickMode: ReaderImageClickMode;
  highlightActionTrigger: HighlightActionTrigger;
  brightness: number;
  orientation: ReaderOrientation;
  mangaHorizontal: boolean;
  mangaAutoScroll: boolean;
  mangaAutoScrollSpeed: number;
  disableMangaTitle: boolean;
  mangaFitScreen: boolean;
  mangaTapScroll: boolean;
  mangaAutoNext: boolean;
  volumeKeyPage: boolean;
  pageAnimation: PageAnimation;
  epaperPageAnimation: PageAnimation;
  letterSpacing: number;
  paragraphSpacing: number;
  paragraphIndent: string;
  textBold: boolean;
  textFullJustify: boolean;
  selectText: boolean;
  showBrightnessOverlay: boolean;
  pageSwipeThreshold: number;
  pageEdgeInset: number;
  pullToToggleBookmark: boolean;
  pullBookmarkDistance: number;
  twoFingerReplacePreview: boolean;
  disableReturnKey: boolean;
  adaptSpecialStyle: boolean;
  showReaderTitleAddition: boolean;
  showReaderTitleChapterNameOnly: boolean;
  progressBarBehavior: ReaderProgressBehavior;
  hideStatusBar: boolean;
  readerChromeFollowsPage: boolean;
  contentInsetHorizontal: number;
  contentInsetVertical: number;
  paperBackground: string;
  paperForeground: string;
  nightBackground: string;
  nightForeground: string;
  epaperBackground: string;
  epaperForeground: string;
  paperBackgroundImage: string;
  nightBackgroundImage: string;
  epaperBackgroundImage: string;
  showReaderHeader: boolean;
  showReaderFooter: boolean;
  readerInfoTextSize: number;
  headerLeftTemplate: string;
  headerMiddleTemplate: string;
  headerRightTemplate: string;
  footerLeftTemplate: string;
  footerMiddleTemplate: string;
  footerRightTemplate: string;
};
export const defaultReaderPreferences: ReaderPreferences = {
  chineseConverterType: 0,
  fontSize: 19,
  lineHeight: 34,
  theme: 'paper',
  mode: 'scroll',
  doublePageMode: 'single',
  imageClickMode: 'default',
  highlightActionTrigger: 'click',
  brightness: 1,
  orientation: 'auto',
  mangaHorizontal: false,
  mangaAutoScroll: false,
  mangaAutoScrollSpeed: 30,
  disableMangaTitle: false,
  mangaFitScreen: false,
  mangaTapScroll: true,
  mangaAutoNext: true,
  volumeKeyPage: true,
  pageAnimation: 'slide',
  epaperPageAnimation: 'none',
  letterSpacing: 0.1,
  paragraphSpacing: 2,
  paragraphIndent: '　　',
  textBold: false,
  textFullJustify: true,
  selectText: true,
  showBrightnessOverlay: true,
  pageSwipeThreshold: 40,
  pageEdgeInset: 0,
  pullToToggleBookmark: false,
  pullBookmarkDistance: 48,
  twoFingerReplacePreview: false,
  disableReturnKey: false,
  adaptSpecialStyle: true,
  showReaderTitleAddition: true,
  showReaderTitleChapterNameOnly: false,
  progressBarBehavior: 'page',
  hideStatusBar: false,
  readerChromeFollowsPage: false,
  contentInsetHorizontal: 26,
  contentInsetVertical: 6,
  paperBackground: '#f4ecd8',
  paperForeground: '#302c24',
  nightBackground: '#171a1c',
  nightForeground: '#c7c9c7',
  epaperBackground: '#ffffff',
  epaperForeground: '#000000',
  paperBackgroundImage: '',
  nightBackgroundImage: '',
  epaperBackgroundImage: '',
  showReaderHeader: false,
  showReaderFooter: true,
  readerInfoTextSize: 12,
  headerLeftTemplate: '{时间}',
  headerMiddleTemplate: '',
  headerRightTemplate: '{电量图标}',
  footerLeftTemplate: '{章节}',
  footerMiddleTemplate: '',
  footerRightTemplate: '{页码}/{总页数}  {阅读进度}',
};
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const color = (value: unknown, fallback: string) =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim())
    ? value.trim().toLowerCase()
    : fallback;
export function normalizeReaderPreferences(
  value: Partial<ReaderPreferences> | null | undefined,
): ReaderPreferences {
  const font = Number(value?.fontSize),
    line = Number(value?.lineHeight),
    brightness = Number(value?.brightness),
    theme = value?.theme,
    mode = value?.mode,
    orientation = value?.orientation;
  return {
    chineseConverterType: value?.chineseConverterType === 1 || value?.chineseConverterType === 2 ? value.chineseConverterType : 0,
    fontSize: clamp(Number.isFinite(font) ? font : 19, 14, 36),
    lineHeight: clamp(Number.isFinite(line) ? line : 34, 22, 60),
    theme:
      theme === 'green' ||
      theme === 'night' ||
      theme === 'paper' ||
      theme === 'epaper'
        ? theme
        : 'paper',
    mode: mode === 'page' ? 'page' : 'scroll',
    doublePageMode:
      value?.doublePageMode === 'double' ||
      value?.doublePageMode === 'landscape' ||
      value?.doublePageMode === 'tabletLandscape'
        ? value.doublePageMode
        : 'single',
    imageClickMode:
      value?.imageClickMode === 'preview' ||
      value?.imageClickMode === 'compat' ||
      value?.imageClickMode === 'disabled' ||
      value?.imageClickMode === 'double'
        ? value.imageClickMode
        : 'default',
    highlightActionTrigger:
      value?.highlightActionTrigger === 'longPress' ||
      value?.highlightActionTrigger === 'off'
        ? value.highlightActionTrigger
        : 'click',
    brightness: clamp(Number.isFinite(brightness) ? brightness : 1, 0.15, 1),
    orientation:
      orientation === 'portrait' || orientation === 'landscape'
        ? orientation
        : 'auto',
    mangaHorizontal: value?.mangaHorizontal === true,
    mangaAutoScroll: value?.mangaAutoScroll === true,
    mangaAutoScrollSpeed: clamp(
      Number.isFinite(Number(value?.mangaAutoScrollSpeed))
        ? Number(value?.mangaAutoScrollSpeed)
        : 30,
      5,
      120,
    ),
    disableMangaTitle: value?.disableMangaTitle === true,
    mangaFitScreen: value?.mangaFitScreen === true,
    mangaTapScroll: value?.mangaTapScroll !== false,
    mangaAutoNext: value?.mangaAutoNext !== false,
    volumeKeyPage: value?.volumeKeyPage !== false,
    epaperPageAnimation: ['none', 'slide', 'cover', 'fade'].includes(
      String(value?.epaperPageAnimation),
    )
      ? value!.epaperPageAnimation!
      : 'none',
    pageAnimation:
      value?.pageAnimation === 'none' ||
      value?.pageAnimation === 'cover' ||
      value?.pageAnimation === 'fade'
        ? value.pageAnimation
        : 'slide',
    letterSpacing: clamp(
      Number.isFinite(Number(value?.letterSpacing))
        ? Number(value?.letterSpacing)
        : 0.1,
      -1,
      4,
    ),
    paragraphSpacing: clamp(
      Number.isFinite(Number(value?.paragraphSpacing))
        ? Number(value?.paragraphSpacing)
        : 2,
      0,
      40,
    ),
    paragraphIndent:
      typeof value?.paragraphIndent === 'string'
        ? value.paragraphIndent.slice(0, 12)
        : '　　',
    textBold: value?.textBold === true,
    textFullJustify: value?.textFullJustify !== false,
    selectText: value?.selectText !== false,
    showBrightnessOverlay: value?.showBrightnessOverlay !== false,
    pageSwipeThreshold: clamp(
      Number.isFinite(Number(value?.pageSwipeThreshold))
        ? Number(value?.pageSwipeThreshold)
        : 40,
      12,
      400,
    ),
    pageEdgeInset: clamp(
      Number.isFinite(Number(value?.pageEdgeInset))
        ? Number(value?.pageEdgeInset)
        : 0,
      0,
      399,
    ),
    pullToToggleBookmark: value?.pullToToggleBookmark === true,
    pullBookmarkDistance: clamp(
      Number.isFinite(Number(value?.pullBookmarkDistance))
        ? Number(value?.pullBookmarkDistance)
        : 48,
      24,
      240,
    ),
    twoFingerReplacePreview: value?.twoFingerReplacePreview === true,
    disableReturnKey: value?.disableReturnKey === true,
    adaptSpecialStyle: value?.adaptSpecialStyle !== false,
    showReaderTitleAddition: value?.showReaderTitleAddition !== false,
    showReaderTitleChapterNameOnly:
      value?.showReaderTitleChapterNameOnly === true,
    progressBarBehavior:
      value?.progressBarBehavior === 'chapter' ? 'chapter' : 'page',
    hideStatusBar: value?.hideStatusBar === true,
    readerChromeFollowsPage: value?.readerChromeFollowsPage === true,
    contentInsetHorizontal: clamp(
      Number.isFinite(Number(value?.contentInsetHorizontal))
        ? Number(value?.contentInsetHorizontal)
        : 26,
      0,
      64,
    ),
    contentInsetVertical: clamp(
      Number.isFinite(Number(value?.contentInsetVertical))
        ? Number(value?.contentInsetVertical)
        : 6,
      0,
      64,
    ),
    paperBackground: color(value?.paperBackground, '#f4ecd8'),
    paperForeground: color(value?.paperForeground, '#302c24'),
    nightBackground: color(value?.nightBackground, '#171a1c'),
    nightForeground: color(value?.nightForeground, '#c7c9c7'),
    epaperBackground: color(value?.epaperBackground, '#ffffff'),
    epaperForeground: color(value?.epaperForeground, '#000000'),
    paperBackgroundImage:
      typeof value?.paperBackgroundImage === 'string'
        ? value.paperBackgroundImage
        : '',
    nightBackgroundImage:
      typeof value?.nightBackgroundImage === 'string'
        ? value.nightBackgroundImage
        : '',
    epaperBackgroundImage:
      typeof value?.epaperBackgroundImage === 'string'
        ? value.epaperBackgroundImage
        : '',
    showReaderHeader: value?.showReaderHeader === true,
    showReaderFooter: value?.showReaderFooter !== false,
    readerInfoTextSize: clamp(
      Number.isFinite(Number(value?.readerInfoTextSize))
        ? Number(value?.readerInfoTextSize)
        : 12,
      5,
      50,
    ),
    headerLeftTemplate:
      typeof value?.headerLeftTemplate === 'string'
        ? value.headerLeftTemplate.slice(0, 200)
        : '{时间}',
    headerMiddleTemplate:
      typeof value?.headerMiddleTemplate === 'string'
        ? value.headerMiddleTemplate.slice(0, 200)
        : '',
    headerRightTemplate:
      typeof value?.headerRightTemplate === 'string'
        ? value.headerRightTemplate.slice(0, 200)
        : '{电量图标}',
    footerLeftTemplate:
      typeof value?.footerLeftTemplate === 'string'
        ? value.footerLeftTemplate.slice(0, 200)
        : '{章节}',
    footerMiddleTemplate:
      typeof value?.footerMiddleTemplate === 'string'
        ? value.footerMiddleTemplate.slice(0, 200)
        : '',
    footerRightTemplate:
      typeof value?.footerRightTemplate === 'string'
        ? value.footerRightTemplate.slice(0, 200)
        : '{页码}/{总页数}  {阅读进度}',
  };
}
export const readerPalette = (
  theme: ReaderTheme,
  preferences: ReaderPreferences = defaultReaderPreferences,
) =>
  theme === 'epaper'
    ? {
        background: preferences.epaperBackground,
        foreground: preferences.epaperForeground,
        chrome: preferences.epaperBackground,
      }
    : theme === 'night'
      ? {
          background: preferences.nightBackground,
          foreground: preferences.nightForeground,
          chrome: preferences.nightBackground,
        }
      : theme === 'green'
        ? { background: '#dce8d5', foreground: '#263126', chrome: '#edf4e9' }
        : {
            background: preferences.paperBackground,
            foreground: preferences.paperForeground,
            chrome: preferences.paperBackground,
          };
export async function loadReaderPreferences() {
  const raw = appStorage.getString(KEY);
  if (!raw) return defaultReaderPreferences;
  try {
    return normalizeReaderPreferences(
      JSON.parse(raw) as Partial<ReaderPreferences>,
    );
  } catch {
    return defaultReaderPreferences;
  }
}
export async function saveReaderPreferences(value: ReaderPreferences) {
  appStorage.set(KEY, JSON.stringify(normalizeReaderPreferences(value)));
}

/** The source uses independent e-ink colors and animation, retaining the normal reading profile. */
export function readerPreferencesForAppTheme(
  preferences: ReaderPreferences,
  themeMode: string,
): ReaderPreferences {
  return themeMode === 'eink'
    ? {
        ...preferences,
        theme: 'epaper',
        pageAnimation: preferences.epaperPageAnimation,
      }
    : preferences;
}
