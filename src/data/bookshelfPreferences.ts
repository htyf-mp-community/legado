import { appStorage } from './storage';
import {
  loadBookshelfLayout,
  loadBookshelfSort,
  saveBookshelfSort,
  type BookGroupSort,
} from './bookshelf';

export const BOOKSHELF_PREFERENCES_KEY = 'bookshelf.preferences.v1';
export type BookshelfPreferences = {
  layout: number;
  groupStyle: number;
  nameStyle: number;
  margin: number;
  sort: BookGroupSort;
  readProgressMode: number;
  showUnread: boolean;
  showLastUpdateTime: boolean;
  showWaitUpCount: boolean;
  showFastScroller: boolean;
  showRecentReading: boolean;
  showStatistics: boolean;
};
export const defaultBookshelfPreferences: BookshelfPreferences = {
  layout: 0,
  groupStyle: 0,
  nameStyle: 0,
  margin: 12,
  sort: 0,
  readProgressMode: 1,
  showUnread: true,
  showLastUpdateTime: false,
  showWaitUpCount: false,
  showFastScroller: false,
  showRecentReading: false,
  showStatistics: false,
};
export function resolveShelfProgressMode(
  value: unknown,
  legacyEnabled?: unknown,
) {
  const number =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^[+-]?\d+$/.test(value.trim())
        ? Number(value.trim())
        : undefined;
  if (number !== undefined && Number.isFinite(number))
    return Math.min(2, Math.max(0, Math.trunc(number)));
  return legacyEnabled === false || legacyEnabled === 'false' ? 0 : 1;
}
const choice = (value: unknown, max: number, fallback: number) =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= max
    ? value
    : fallback;
export function normalizeBookshelfPreferences(
  value: Partial<BookshelfPreferences>,
): BookshelfPreferences {
  const result = { ...defaultBookshelfPreferences, ...value };
  result.layout = choice(value.layout, 6, 0);
  result.groupStyle = choice(value.groupStyle, 1, 0);
  result.nameStyle = choice(value.nameStyle, 2, 0);
  result.margin = choice(value.margin, 60, 12);
  result.sort = choice(value.sort, 5, 0) as BookGroupSort;
  result.readProgressMode = resolveShelfProgressMode(value.readProgressMode);
  for (const key of [
    'showUnread',
    'showLastUpdateTime',
    'showWaitUpCount',
    'showFastScroller',
    'showRecentReading',
    'showStatistics',
  ] as const) {
    result[key] =
      typeof value[key] === 'boolean'
        ? value[key]
        : defaultBookshelfPreferences[key];
  }
  return result;
}
let cachedRaw: string | undefined,
  cachedSort: number | undefined,
  cachedLegacy: string | undefined;
let cached: { preferences: BookshelfPreferences; error?: string } | undefined;
export function getBookshelfPreferencesSnapshot() {
  const raw = appStorage.getString(BOOKSHELF_PREFERENCES_KEY),
    sort = loadBookshelfSort(),
    legacy = loadBookshelfLayout();
  if (
    cached &&
    raw === cachedRaw &&
    sort === cachedSort &&
    legacy === cachedLegacy
  )
    return cached;
  cachedRaw = raw;
  cachedSort = sort;
  cachedLegacy = legacy;
  try {
    const data: unknown =
      raw === undefined
        ? { layout: legacy === 'grid' ? 3 : 0 }
        : JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data))
      throw new Error('书架配置无效');
    cached = { preferences: normalizeBookshelfPreferences({ ...data, sort }) };
  } catch (cause) {
    cached = {
      preferences: { ...defaultBookshelfPreferences, sort },
      error: cause instanceof Error ? cause.message : String(cause),
    };
  }
  return cached;
}
export function subscribeBookshelfPreferences(changed: () => void) {
  const listener = appStorage.addOnValueChangedListener(key => {
    if (
      [
        BOOKSHELF_PREFERENCES_KEY,
        'bookshelf.sort.v1',
        'bookshelf.layout.v1',
      ].includes(key)
    )
      changed();
  });
  return () => listener.remove();
}
export function saveBookshelfPreferences(value: BookshelfPreferences) {
  const next = normalizeBookshelfPreferences(value);
  appStorage.set(BOOKSHELF_PREFERENCES_KEY, JSON.stringify(next));
  saveBookshelfSort(next.sort);
  return next;
}
