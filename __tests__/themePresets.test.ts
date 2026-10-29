jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ getString: jest.fn(), set: jest.fn() }),
}));

import { defaultAppPreferences } from '../src/data/appPreferences';
import {
  applyThemePreset,
  loadThemePresets,
  mergeThemePresets,
  parseThemePresets,
  themePresetFromPreferences,
} from '../src/data/themePresets';

const androidTheme = {
  themeName: '典雅蓝',
  isNightTheme: false,
  primaryColor: '#03A9F4',
  accentColor: '#AD1457',
  backgroundColor: '#F5F5F5',
  bottomBackground: '#EEEEEE',
  transparentNavBar: false,
  backgroundImgPath: 'https://example.test/background.jpg',
  backgroundImgBlur: 3,
};

test('imports Android ThemeConfig object and arrays losslessly', () => {
  expect(parseThemePresets(JSON.stringify(androidTheme))).toEqual([
    androidTheme,
  ]);
  expect(parseThemePresets(JSON.stringify([androidTheme]))).toEqual([
    androidTheme,
  ]);
});

test('rejects malformed theme names and colors', () => {
  expect(() =>
    parseThemePresets(JSON.stringify({ ...androidTheme, themeName: '' })),
  ).toThrow('name');
  expect(() =>
    parseThemePresets(
      JSON.stringify({ ...androidTheme, primaryColor: 'blue' }),
    ),
  ).toThrow('color');
});

test('overwrites presets by Android-compatible theme name identity', () => {
  expect(
    mergeThemePresets(
      [androidTheme],
      [{ ...androidTheme, primaryColor: '#112233' }],
    )[0].primaryColor,
  ).toBe('#112233');
});

test('captures and applies the active side of appearance preferences', () => {
  const night = themePresetFromPreferences(
      'Night',
      defaultAppPreferences,
      true,
    ),
    applied = applyThemePreset(defaultAppPreferences, {
      ...night,
      primaryColor: '#123456',
    });
  expect(night.isNightTheme).toBe(true);
  expect(applied.themeMode).toBe('dark');
  expect(applied.nightPrimary).toBe('#123456');
  expect(applied.dayPrimary).toBe(defaultAppPreferences.dayPrimary);
});

test('a new collection includes the four source presets', () => {
  expect(loadThemePresets().map(theme => theme.themeName)).toEqual([
    '默认',
    '典雅蓝',
    '黑白',
    'A屏黑',
  ]);
});
