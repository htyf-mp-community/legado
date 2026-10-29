import { getLocales } from 'react-native-localize';
import { appStorage } from './storage';

const KEY = 'app.preferences.v1';
export type ThemeMode = 'system' | 'light' | 'dark' | 'eink';
export type LanguageMode = 'system' | 'zh-CN' | 'en';
export type AppPreferences = {
  themeMode: ThemeMode;
  language: LanguageMode;
  highContrast: boolean;
  barElevation: number;
  dayPrimary: string;
  dayAccent: string;
  dayBackground: string;
  dayBottomBackground: string;
  dayBackgroundImage: string;
  nightPrimary: string;
  nightAccent: string;
  nightBackground: string;
  nightBottomBackground: string;
  nightBackgroundImage: string;
};
export const defaultAppPreferences: AppPreferences = {
  themeMode: 'system',
  language: 'system',
  highContrast: false,
  barElevation: 4,
  dayPrimary: '#795548',
  dayAccent: '#E53935',
  dayBackground: '#F5F5F5',
  dayBottomBackground: '#EEEEEE',
  dayBackgroundImage: '',
  nightPrimary: '#546E7A',
  nightAccent: '#D84315',
  nightBackground: '#212121',
  nightBottomBackground: '#303030',
  nightBackgroundImage: '',
};
const color = (value: unknown, fallback: string) =>
  /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(String(value))
    ? String(value)
    : fallback;
export function normalizeAppPreferences(
  value: Partial<AppPreferences>,
): AppPreferences {
  return {
    themeMode: ['system', 'light', 'dark', 'eink'].includes(
      String(value.themeMode),
    )
      ? (value.themeMode as ThemeMode)
      : 'system',
    language: ['system', 'zh-CN', 'en'].includes(String(value.language))
      ? (value.language as LanguageMode)
      : 'system',
    highContrast: value.highContrast === true,
    barElevation: Math.max(
      0,
      Math.min(
        32,
        Math.round(
          Number.isFinite(value.barElevation)
            ? Number(value.barElevation)
            : defaultAppPreferences.barElevation,
        ),
      ),
    ),
    dayPrimary: color(value.dayPrimary, defaultAppPreferences.dayPrimary),
    dayAccent: color(value.dayAccent, defaultAppPreferences.dayAccent),
    dayBackground: color(
      value.dayBackground,
      defaultAppPreferences.dayBackground,
    ),
    dayBottomBackground: color(
      value.dayBottomBackground,
      defaultAppPreferences.dayBottomBackground,
    ),
    dayBackgroundImage: String(value.dayBackgroundImage ?? ''),
    nightPrimary: color(value.nightPrimary, defaultAppPreferences.nightPrimary),
    nightAccent: color(value.nightAccent, defaultAppPreferences.nightAccent),
    nightBackground: color(
      value.nightBackground,
      defaultAppPreferences.nightBackground,
    ),
    nightBottomBackground: color(
      value.nightBottomBackground,
      defaultAppPreferences.nightBottomBackground,
    ),
    nightBackgroundImage: String(value.nightBackgroundImage ?? ''),
  };
}
export function loadAppPreferences() {
  const raw = appStorage.getString(KEY);
  if (!raw) return defaultAppPreferences;
  try {
    return normalizeAppPreferences(JSON.parse(raw));
  } catch {
    return defaultAppPreferences;
  }
}
export function saveAppPreferences(value: AppPreferences) {
  const normalized = normalizeAppPreferences(value);
  appStorage.set(KEY, JSON.stringify(normalized));
  return normalized;
}
export function resolvedLanguage(mode: LanguageMode, locales = getLocales()) {
  if (mode !== 'system') return mode;
  return locales[0]?.languageCode?.toLowerCase() === 'zh' ? 'zh-CN' : 'en';
}
