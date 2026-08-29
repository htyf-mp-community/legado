const mockValues = new Map<string, string>();
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => mockValues.get(key),
    set: (key: string, value: string) => mockValues.set(key, value),
  }),
}));
import {
  exportFileBaseName,
  loadBookExportPreferences,
  saveBookExportPreferences,
} from '../src/data/exportPreferences';

test('persists export preferences in the dedicated MMKV adapter', () => {
  saveBookExportPreferences({
    useReplace: true,
    noChapterName: true,
    parallel: true,
    charset: 'GB18030',
    fileNamePattern: '{author}-{name}',
    epubChapterScope: '1-3,5',
    epubChaptersPerFile: 2,
    exportToWebDav: true,
    exportPictureFile: true,
  });
  expect(loadBookExportPreferences()).toMatchObject({
    useReplace: true,
    noChapterName: true,
    parallel: true,
    charset: 'GB18030',
    epubChapterScope: '1-3,5',
    epubChaptersPerFile: 2,
    exportToWebDav: true,
    exportPictureFile: true,
  });
  expect(
    exportFileBaseName('{author}-{name}', { name: 'Book', author: 'Writer' }),
  ).toBe('Writer-Book');
});

test('falls back safely from invalid persisted values', () => {
  mockValues.set(
    'book-export.preferences.v1',
    '{"charset":"bad","fileNamePattern":""}',
  );
  expect(loadBookExportPreferences()).toMatchObject({
    charset: 'UTF-8',
    fileNamePattern: '{name}_{author}',
  });
});
