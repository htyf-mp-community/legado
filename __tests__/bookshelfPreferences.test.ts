jest.mock('../src/data/storage', () => {
  const values = new Map<string, string | number>(),
    listeners = new Set<(mockKey: string) => void>();
  return {
    appStorage: {
      getString: (key: string) => {
        const value = values.get(key);
        return typeof value === 'string' ? value : undefined;
      },
      getNumber: (key: string) => {
        const value = values.get(key);
        return typeof value === 'number' ? value : undefined;
      },
      set: (key: string, value: string | number) => {
        values.set(key, value);
        listeners.forEach(listener => listener(key));
      },
      remove: (key: string) => {
        values.delete(key);
        listeners.forEach(listener => listener(key));
      },
      addOnValueChangedListener: (listener: (mockKey: string) => void) => {
        listeners.add(listener);
        return { remove: () => listeners.delete(listener) };
      },
    },
  };
});
import { appStorage } from '../src/data/storage';
import { loadBookGroupSort, saveBookGroups } from '../src/data/bookshelf';
import {
  BOOKSHELF_PREFERENCES_KEY,
  defaultBookshelfPreferences,
  getBookshelfPreferencesSnapshot,
  normalizeBookshelfPreferences,
  saveBookshelfPreferences,
  resolveShelfProgressMode,
  subscribeBookshelfPreferences,
} from '../src/data/bookshelfPreferences';
beforeEach(() => {
  [
    BOOKSHELF_PREFERENCES_KEY,
    'bookshelf.layout.v1',
    'bookshelf.sort.v1',
    'bookshelf.groups.v1',
  ].forEach(key => appStorage.remove(key));
});
test('source defaults and the old grid setting load without overwriting stored data', () => {
  expect(getBookshelfPreferencesSnapshot().preferences).toEqual(
    defaultBookshelfPreferences,
  );
  appStorage.set('bookshelf.layout.v1', 'grid');
  expect(getBookshelfPreferencesSnapshot().preferences.layout).toBe(3);
  expect(appStorage.getString(BOOKSHELF_PREFERENCES_KEY)).toBeUndefined();
});
test('confirmed settings preserve all fields and global sort updates inheriting groups only', () => {
  saveBookGroups([
    {
      id: '1',
      name: 'Custom',
      order: 1,
      show: true,
      enableRefresh: true,
      bookSort: 2,
    },
  ]);
  const next = {
    ...defaultBookshelfPreferences,
    layout: 6,
    groupStyle: 1,
    nameStyle: 2,
    margin: 45,
    sort: 5 as const,
    readProgressMode: 2,
    showStatistics: true,
    showRecentReading: true,
    showFastScroller: true,
  };
  saveBookshelfPreferences(next);
  expect(getBookshelfPreferencesSnapshot().preferences).toEqual(next);
  expect(loadBookGroupSort('-1')).toBe(5);
  expect(loadBookGroupSort('1')).toBe(2);
});
test('external changes update stable snapshots, unrelated keys and removed listeners do not notify', () => {
  const original = getBookshelfPreferencesSnapshot(),
    changed = jest.fn(),
    remove = subscribeBookshelfPreferences(changed);
  expect(getBookshelfPreferencesSnapshot()).toBe(original);
  appStorage.set('other', 'x');
  expect(changed).not.toHaveBeenCalled();
  appStorage.set('bookshelf.sort.v1', 3);
  expect(changed).toHaveBeenCalledTimes(1);
  expect(getBookshelfPreferencesSnapshot().preferences.sort).toBe(3);
  remove();
  appStorage.set('bookshelf.sort.v1', 4);
  expect(changed).toHaveBeenCalledTimes(1);
});
test('corrupt configuration is retained and surfaced; out-of-range choices normalize to source defaults', () => {
  appStorage.set(BOOKSHELF_PREFERENCES_KEY, '{broken');
  expect(getBookshelfPreferencesSnapshot().error).toBeTruthy();
  expect(appStorage.getString(BOOKSHELF_PREFERENCES_KEY)).toBe('{broken');
  expect(
    normalizeBookshelfPreferences({
      layout: 99,
      groupStyle: -1,
      margin: 61,
      readProgressMode: 1,
    }),
  ).toEqual(defaultBookshelfPreferences);
});
test('progress mode clamps numeric legacy values and resolves old boolean switches', () => {
  expect(resolveShelfProgressMode(' 3 ')).toBe(2);
  expect(resolveShelfProgressMode(-1)).toBe(0);
  expect(resolveShelfProgressMode(undefined, 'false')).toBe(0);
  expect(resolveShelfProgressMode(undefined, true)).toBe(1);
});
