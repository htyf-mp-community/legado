const mockValues = new Map<string, string>();
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => mockValues.get(key),
    set: (key: string, value: string) => mockValues.set(key, value),
  }),
}));
import {
  loadRestoreIgnore,
  saveRestoreIgnore,
  normalizeRestoreIgnore,
} from '../src/data/restorePreferences';
beforeEach(() => mockValues.clear());
test('ten ignore choices default false, persist together, and require actual booleans', () => {
  expect(Object.keys(loadRestoreIgnore())).toHaveLength(10);
  expect(Object.values(loadRestoreIgnore()).every(value => !value)).toBe(true);
  saveRestoreIgnore({ readConfig: true, localBook: true });
  expect(loadRestoreIgnore()).toMatchObject({
    readConfig: true,
    localBook: true,
    themeMode: false,
  });
  expect(normalizeRestoreIgnore({ readConfig: 'false' }).readConfig).toBe(
    false,
  );
});
