import type { AppPreferences } from '../data/appPreferences';

/** Matches ColorUtils.isColorLight: AndroidX relative luminance >= 0.5. */
export function toolbarForeground(color: string) {
  const channels = [1, 3, 5].map(
    start => parseInt(color.slice(start, start + 2), 16) / 255,
  );
  const linear = channels.map(value =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722 >= 0.5
    ? '#000000'
    : '#FFFFFF';
}

export function resolveAppColors(preferences: AppPreferences, dark: boolean) {
  if (preferences.themeMode === 'eink')
    return {
      background: '#FFFFFF',
      surface: '#FFFFFF',
      text: '#000000',
      muted: '#000000',
      border: '#000000',
      primary: '#000000',
      danger: '#000000',
      accent: '#000000',
      toolbarBackground: '#FFFFFF',
      toolbarText: '#000000',
    };
  const primary = dark ? preferences.nightPrimary : preferences.dayPrimary;
  const accent = dark ? preferences.nightAccent : preferences.dayAccent;
  return {
    background: dark ? preferences.nightBackground : preferences.dayBackground,
    surface: dark
      ? preferences.nightBottomBackground
      : preferences.dayBottomBackground,
    text: dark ? '#FFFFFF' : '#000000DE',
    muted: dark ? '#B3B3B3' : '#2C2C2C8A',
    border: dark ? '#424242' : '#D8D8D8',
    primary,
    danger: accent,
    accent,
    toolbarBackground: primary,
    toolbarText: toolbarForeground(primary),
  };
}
