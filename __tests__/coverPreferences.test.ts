import {
  coverDisplayText,
  defaultCoverPreferences,
  loadCoverPreferences,
  saveCoverPreferences,
} from '../src/data/coverPreferences';

jest.mock('../src/data/storage', () => {
  const values = new Map<string, string>();
  return {
    appStorage: {
      getString: (key: string) => values.get(key),
      set: (key: string, value: unknown) => values.set(key, String(value)),
      remove: (key: string) => values.delete(key),
    },
  };
});

test('cover preferences persist in the application MMKV adapter', () => {
  const saved = saveCoverPreferences({
    ...defaultCoverPreferences,
    loadOnlyWifi: true,
    defaultCover: 'file:///cover.jpg',
    showAuthorDark: false,
  });
  expect(saved.loadOnlyWifi).toBe(true);
  expect(loadCoverPreferences()).toEqual(saved);
});
test('cover title punctuation policy matches the user setting', () => {
  expect(coverDisplayText('《阅读：测试！》', false)).toBe('阅读测试');
  expect(coverDisplayText('《阅读：测试！》', true)).toBe('《阅读：测试！》');
});
test('source punctuation policy retains inner spaces, symbols and emoji', () => {
  expect(coverDisplayText('  A B + 😀！  ', false)).toBe('A B + 😀');
  expect(coverDisplayText('《》', false)).toBe('');
});
