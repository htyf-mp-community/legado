jest.mock('../src/data/storage', () => {
  const values = new Map<string, string>();
  const listeners = new Set<(mockKey: string) => void>();
  return {
    appStorage: {
      getString: (key: string) => values.get(key),
      set: (key: string, value: string) => {
        values.set(key, value);
        listeners.forEach(listener => listener(key));
      },
      addOnValueChangedListener: (listener: (mockKey: string) => void) => {
        listeners.add(listener);
        return { remove: () => listeners.delete(listener) };
      },
    },
  };
});
jest.mock('../src/data/appLog', () => ({ addAppLog: jest.fn() }));
import { appStorage } from '../src/data/storage';
import {
  getLibrarySnapshot,
  loadLibrary,
  saveLibrary,
  subscribeLibrary,
  updateLibrary,
} from '../src/data/library';
import type { Book } from '../src/types';
const make = (id: string): Book => ({
  id,
  name: id,
  author: '',
  intro: '',
  chapterTitle: 'One',
  content: 'text',
  progress: 0,
  updatedAt: 1,
});
beforeEach(async () => {
  await saveLibrary([]);
});
test('stable snapshots update for direct external writes and ignore unrelated storage changes', () => {
  const changed = jest.fn(),
    remove = subscribeLibrary(changed);
  const empty = getLibrarySnapshot();
  expect(getLibrarySnapshot()).toBe(empty);
  appStorage.set('other.preference', 'true');
  expect(changed).not.toHaveBeenCalled();
  appStorage.set('library.v1', JSON.stringify([make('web-import')]));
  expect(changed).toHaveBeenCalledTimes(1);
  expect(getLibrarySnapshot().books[0].id).toBe('web-import');
  expect(getLibrarySnapshot()).toBe(getLibrarySnapshot());
  remove();
  appStorage.set('library.v1', '[]');
  expect(changed).toHaveBeenCalledTimes(1);
});
test('atomic per-book transforms retain concurrent imported books', async () => {
  await Promise.all([
    updateLibrary(current => [...current, make('one')]),
    updateLibrary(current => [...current, make('two')]),
  ]);
  await updateLibrary(current =>
    current.map(book =>
      book.id === 'one' ? { ...book, progress: 0.5 } : book,
    ),
  );
  expect((await loadLibrary()).map(book => [book.id, book.progress])).toEqual([
    ['one', 0.5],
    ['two', 0],
  ]);
});
test('corrupt external data produces a stable recovery snapshot and successful restore clears it', async () => {
  appStorage.set('library.v1', '{broken');
  const failed = getLibrarySnapshot();
  expect(failed.error).toBeDefined();
  expect(getLibrarySnapshot()).toBe(failed);
  await expect(
    updateLibrary(current => [...current, make('lost')]),
  ).rejects.toThrow();
  expect(appStorage.getString('library.v1')).toBe('{broken');
  await saveLibrary([make('restored')]);
  expect(getLibrarySnapshot().error).toBeUndefined();
  expect(getLibrarySnapshot().books[0].id).toBe('restored');
});
