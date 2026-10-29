jest.mock('react-native-localize', () => ({
  getLocales: () => [{ languageCode: 'zh' }],
}));
jest.mock('../src/data/storage', () => ({
  appStorage: { getString: jest.fn(), set: jest.fn() },
}));
import {
  defaultAppPreferences,
  normalizeAppPreferences,
} from '../src/data/appPreferences';
import { resolveAppColors, toolbarForeground } from '../src/theme/appColors';
test('new installations use the source day/night colors', () => {
  expect(resolveAppColors(defaultAppPreferences, false)).toMatchObject({
    background: '#F5F5F5',
    toolbarBackground: '#795548',
    accent: '#E53935',
    surface: '#EEEEEE',
    toolbarText: '#FFFFFF',
  });
  expect(resolveAppColors(defaultAppPreferences, true)).toMatchObject({
    background: '#212121',
    toolbarBackground: '#546E7A',
    accent: '#D84315',
    surface: '#303030',
  });
});
test('custom colors survive normalization and determine toolbar contrast', () => {
  const preferences = normalizeAppPreferences({
    dayPrimary: '#FEFEFE',
    dayAccent: '#123456',
  });
  expect(resolveAppColors(preferences, false)).toMatchObject({
    primary: '#FEFEFE',
    accent: '#123456',
    toolbarText: '#000000',
  });
  expect(toolbarForeground('#808080')).toBe('#FFFFFF');
});
test('e-ink uses monochrome without overwriting saved day/night colors', () => {
  const preferences = normalizeAppPreferences({
    ...defaultAppPreferences,
    themeMode: 'eink',
  });
  expect(resolveAppColors(preferences, false)).toMatchObject({
    background: '#FFFFFF',
    text: '#000000',
    accent: '#000000',
    toolbarBackground: '#FFFFFF',
  });
  expect(preferences.dayPrimary).toBe('#795548');
});
