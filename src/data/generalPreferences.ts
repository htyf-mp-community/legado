import { appStorage } from './storage';

const KEY = 'general.preferences.v1';

export type HomePage = 'bookshelf' | 'explore' | 'rss' | 'mine';
export type GeneralPreferences = {
  defaultHomePage: HomePage;
  showExplore: boolean;
  showRss: boolean;
  userAgent: string;
  threadCount: number;
  preDownloadNum: number;
  sourceEditMaxLine: number;
  autoClearExpired: boolean;
  autoRefreshBookshelf: boolean;
  onlyUpdateRead: boolean;
  replaceEnableDefault: boolean;
  tocUiUseReplace: boolean;
  tocCountWords: boolean;
  defaultToRead: boolean;
  imageRetainNum: number;
  showMangaUi: boolean;
  autoChangeSource: boolean;
};

export const defaultGeneralPreferences: GeneralPreferences = {
  defaultHomePage: 'bookshelf',
  showExplore: true,
  showRss: true,
  userAgent: '',
  threadCount: 4,
  preDownloadNum: 2,
  sourceEditMaxLine: 20,
  autoClearExpired: true,
  autoRefreshBookshelf: false,
  onlyUpdateRead: false,
  replaceEnableDefault: true,
  tocUiUseReplace: true,
  tocCountWords: false,
  defaultToRead: false,
  imageRetainNum: 0,
  showMangaUi: true,
  autoChangeSource: true,
};

const boundedInteger = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) => {
  const number = Number(value);
  return Math.min(
    max,
    Math.max(min, Math.floor(Number.isFinite(number) ? number : fallback)),
  );
};

export function normalizeGeneralPreferences(
  value: Partial<GeneralPreferences>,
): GeneralPreferences {
  const showExplore = value.showExplore !== false;
  const showRss = value.showRss !== false;
  let defaultHomePage: HomePage = [
    'bookshelf',
    'explore',
    'rss',
    'mine',
  ].includes(String(value.defaultHomePage))
    ? (value.defaultHomePage as HomePage)
    : 'bookshelf';
  if (defaultHomePage === 'explore' && !showExplore)
    defaultHomePage = 'bookshelf';
  if (defaultHomePage === 'rss' && !showRss) defaultHomePage = 'bookshelf';
  return {
    defaultHomePage,
    showExplore,
    showRss,
    userAgent: String(value.userAgent ?? '')
      .trim()
      .slice(0, 512),
    threadCount: boundedInteger(value.threadCount, 4, 1, 16),
    preDownloadNum: boundedInteger(value.preDownloadNum, 2, 0, 10),
    sourceEditMaxLine: boundedInteger(value.sourceEditMaxLine, 20, 3, 100),
    autoClearExpired: value.autoClearExpired !== false,
    autoRefreshBookshelf: value.autoRefreshBookshelf === true,
    onlyUpdateRead: value.onlyUpdateRead === true,
    replaceEnableDefault: value.replaceEnableDefault !== false,
    tocUiUseReplace: value.tocUiUseReplace !== false,
    tocCountWords: value.tocCountWords === true,
    defaultToRead: value.defaultToRead === true,
    imageRetainNum: boundedInteger(value.imageRetainNum, 0, 0, 100),
    showMangaUi: value.showMangaUi !== false,
    autoChangeSource: value.autoChangeSource !== false,
  };
}

export function loadGeneralPreferences(): GeneralPreferences {
  const raw = appStorage.getString(KEY);
  if (!raw) return defaultGeneralPreferences;
  try {
    return normalizeGeneralPreferences(JSON.parse(raw));
  } catch {
    return defaultGeneralPreferences;
  }
}

export function saveGeneralPreferences(value: GeneralPreferences) {
  const normalized = normalizeGeneralPreferences(value);
  appStorage.set(KEY, JSON.stringify(normalized));
  return normalized;
}
