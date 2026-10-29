import { appStorage } from './storage';

export const COVER_PREFERENCES_KEY = 'cover.preferences.v1';
const KEY = COVER_PREFERENCES_KEY;
export type CoverPreferences = {
  loadOnlyWifi: boolean;
  useDefaultCover: boolean;
  horizontal: boolean;
  keepPunctuation: boolean;
  defaultCover: string;
  defaultCoverDark: string;
  showName: boolean;
  showAuthor: boolean;
  showNameDark: boolean;
  showAuthorDark: boolean;
};
export const defaultCoverPreferences: CoverPreferences = {
  loadOnlyWifi: false,
  useDefaultCover: false,
  horizontal: false,
  keepPunctuation: false,
  defaultCover: '',
  defaultCoverDark: '',
  showName: true,
  showAuthor: true,
  showNameDark: true,
  showAuthorDark: true,
};
export function normalizeCoverPreferences(
  value: Partial<CoverPreferences>,
): CoverPreferences {
  return {
    ...defaultCoverPreferences,
    ...value,
    defaultCover: String(value.defaultCover ?? ''),
    defaultCoverDark: String(value.defaultCoverDark ?? ''),
  };
}
export function loadCoverPreferences() {
  const raw = appStorage.getString(KEY);
  if (!raw) return defaultCoverPreferences;
  try {
    return normalizeCoverPreferences(
      JSON.parse(raw) as Partial<CoverPreferences>,
    );
  } catch {
    return defaultCoverPreferences;
  }
}
export function saveCoverPreferences(value: CoverPreferences) {
  const normalized = normalizeCoverPreferences(value);
  appStorage.set(KEY, JSON.stringify(normalized));
  return normalized;
}
export function coverDisplayText(value: string, keepPunctuation: boolean) {
  return (keepPunctuation ? value : value.replace(/\p{P}+/gu, '')).trim();
}

let snapshotRaw: string | undefined;
let snapshot: CoverPreferences | undefined;
export function getCoverPreferencesSnapshot() {
  const raw = appStorage.getString(KEY);
  if (!snapshot || snapshotRaw !== raw) {
    snapshotRaw = raw;
    snapshot = loadCoverPreferences();
  }
  return snapshot;
}
export function subscribeCoverPreferences(changed: () => void) {
  const listener = appStorage.addOnValueChangedListener(key => {
    if (key === KEY) changed();
  });
  return () => listener.remove();
}
