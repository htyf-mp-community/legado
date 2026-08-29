import type { AppPreferences } from './appPreferences';
import { appStorage } from './storage';

const KEY = 'appearance.theme-presets.v1';

export type ThemePreset = {
  themeName: string;
  isNightTheme: boolean;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  bottomBackground: string;
  transparentNavBar: boolean;
  backgroundImgPath?: string;
  backgroundImgBlur: number;
};

const color = (value: unknown) => {
  const result = String(value ?? '').trim();
  if (!/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(result))
    throw new Error(`Invalid theme color: ${result || '(empty)'}`);
  return result;
};

export function normalizeThemePreset(value: unknown): ThemePreset {
  if (!value || typeof value !== 'object') throw new Error('Theme must be an object');
  const raw = value as Record<string, unknown>,
    themeName = String(raw.themeName ?? '').trim();
  if (!themeName) throw new Error('Theme name is required');
  return {
    themeName,
    isNightTheme: raw.isNightTheme === true,
    primaryColor: color(raw.primaryColor),
    accentColor: color(raw.accentColor),
    backgroundColor: color(raw.backgroundColor),
    bottomBackground: color(raw.bottomBackground),
    transparentNavBar: raw.transparentNavBar === true,
    backgroundImgPath: String(raw.backgroundImgPath ?? '').trim() || undefined,
    backgroundImgBlur: Math.max(0, Math.min(100, Number(raw.backgroundImgBlur) || 0)),
  };
}

export function parseThemePresets(input: string) {
  let value: unknown;
  try { value = JSON.parse(input); } catch { throw new Error('Theme is not valid JSON'); }
  const list = Array.isArray(value) ? value : [value];
  if (!list.length) throw new Error('Theme list is empty');
  return list.map(normalizeThemePreset);
}

export function mergeThemePresets(current: ThemePreset[], incoming: ThemePreset[]) {
  const result = [...current];
  for (const preset of incoming) {
    const index = result.findIndex(item => item.themeName === preset.themeName);
    if (index < 0) result.push(preset); else result[index] = preset;
  }
  return result;
}

export function loadThemePresets() {
  const raw = appStorage.getString(KEY);
  if (!raw) return [];
  try { return parseThemePresets(raw); } catch { return []; }
}

export function saveThemePresets(value: ThemePreset[]) {
  const normalized = mergeThemePresets([], value.map(normalizeThemePreset));
  appStorage.set(KEY, JSON.stringify(normalized));
  return normalized;
}

export function themePresetFromPreferences(
  themeName: string,
  preferences: AppPreferences,
  isNightTheme: boolean,
): ThemePreset {
  return normalizeThemePreset({
    themeName,
    isNightTheme,
    primaryColor: isNightTheme ? preferences.nightPrimary : preferences.dayPrimary,
    accentColor: isNightTheme ? preferences.nightAccent : preferences.dayAccent,
    backgroundColor: isNightTheme ? preferences.nightBackground : preferences.dayBackground,
    bottomBackground: isNightTheme ? preferences.nightBottomBackground : preferences.dayBottomBackground,
    backgroundImgPath: isNightTheme ? preferences.nightBackgroundImage : preferences.dayBackgroundImage,
    transparentNavBar: false,
    backgroundImgBlur: 0,
  });
}

export function applyThemePreset(preferences: AppPreferences, preset: ThemePreset): AppPreferences {
  const common = { ...preferences, themeMode: preset.isNightTheme ? 'dark' as const : 'light' as const };
  return preset.isNightTheme
    ? { ...common, nightPrimary: preset.primaryColor, nightAccent: preset.accentColor, nightBackground: preset.backgroundColor, nightBottomBackground: preset.bottomBackground, nightBackgroundImage: preset.backgroundImgPath ?? '' }
    : { ...common, dayPrimary: preset.primaryColor, dayAccent: preset.accentColor, dayBackground: preset.backgroundColor, dayBottomBackground: preset.bottomBackground, dayBackgroundImage: preset.backgroundImgPath ?? '' };
}

export const exportThemePreset = (preset: ThemePreset) => JSON.stringify(preset, null, 2);
