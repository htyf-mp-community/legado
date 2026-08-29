jest.mock('@dr.pogodin/react-native-fs', () => ({
  CachesDirectoryPath: '/cache',
  mkdir: jest.fn(),
  unlink: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn(),
}));
jest.mock('@react-native-documents/picker', () => ({
  saveDocuments: jest.fn(),
}));
jest.mock('react-native-nitro-unzip', () => ({ getUnzip: jest.fn() }));
jest.mock('react-native-quick-base64', () => ({
  fromByteArray: jest.fn(() => 'base64'),
}));
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ getString: jest.fn(), set: jest.fn() }),
}));
jest.mock('../src/data/remoteBackup', () => ({ loadWebDavConfig: jest.fn() }));
import { saveDocuments } from '@react-native-documents/picker';
import iconv from 'iconv-lite';
import { getUnzip } from 'react-native-nitro-unzip';
import { writeFile, unlink } from '@dr.pogodin/react-native-fs';
import { fromByteArray } from 'react-native-quick-base64';
import { appStorage } from '../src/data/storage';
import {
  bulkBookExportEntries,
  parseChapterScope,
  saveBulkBookExport,
} from '../src/core/bulkBookExport';
import { DEFAULT_BOOK_EXPORT_PREFERENCES } from '../src/data/exportPreferences';
import type { Book } from '../src/types';

const make = (id: string, name = 'Same'): Book => ({
  id,
  name,
  author: 'Author',
  intro: '',
  chapterTitle: 'One',
  content: 'body',
  chapters: [{ id: `${id}-1`, title: 'One', content: 'body' }],
  progress: 0,
  updatedAt: 1,
});

beforeEach(() => jest.clearAllMocks());

test('selects requested books and disambiguates duplicate export names', () => {
  expect(
    bulkBookExportEntries(
      [make('a'), make('b'), make('c', 'Other')],
      new Set(['a', 'b']),
      'epub',
    ).map(item => item.fileName),
  ).toEqual(['Same_Author.epub', 'Same_Author_2.epub']);
});

test('uses a configurable filename pattern', () => {
  expect(
    bulkBookExportEntries([make('a')], new Set(['a']), 'txt', {
      ...DEFAULT_BOOK_EXPORT_PREFERENCES,
      useReplace: false,
      noChapterName: false,
      parallel: false,
      charset: 'UTF-8',
      fileNamePattern: '{author}-{name}',
    })[0].fileName,
  ).toBe('Author-Same.txt');
});

test('writes selected books, zips them, saves one document and cleans temporary paths', async () => {
  const awaitZip = jest.fn().mockResolvedValue(undefined);
  (getUnzip as jest.Mock).mockReturnValue({
    zip: jest.fn(() => ({ await: awaitZip })),
  });
  (saveDocuments as jest.Mock).mockResolvedValue([
    { uri: 'content://saved', error: null },
  ]);
  const progress = jest.fn(),
    result = await saveBulkBookExport(
      [make('a'), make('b')],
      new Set(['a', 'b']),
      'txt',
      progress,
    );
  expect(result.uri).toBe('content://saved');
  expect(writeFile).toHaveBeenCalledTimes(2);
  expect(progress).toHaveBeenLastCalledWith(2, 2, 'Same');
  expect(awaitZip).toHaveBeenCalled();
  expect(unlink).toHaveBeenCalledTimes(2);
});

test('applies enabled replacement rules and selected TXT charset', async () => {
  (appStorage.getString as jest.Mock).mockImplementation((key: string) =>
    key === 'replace.rules.v1'
      ? JSON.stringify([
          {
            id: 1,
            name: 'clean',
            pattern: 'body',
            replacement: 'clean',
            isRegex: false,
            isEnabled: true,
            scopeContent: true,
            scopeTitle: false,
            scopeSource: false,
            order: 0,
          },
        ])
      : undefined,
  );
  const awaitZip = jest.fn().mockResolvedValue(undefined);
  (getUnzip as jest.Mock).mockReturnValue({
    zip: jest.fn(() => ({ await: awaitZip })),
  });
  (saveDocuments as jest.Mock).mockResolvedValue([
    { uri: 'content://saved', error: null },
  ]);
  await saveBulkBookExport([make('a')], new Set(['a']), 'txt', undefined, {
    ...DEFAULT_BOOK_EXPORT_PREFERENCES,
    useReplace: true,
    noChapterName: true,
    parallel: true,
    charset: 'GB18030',
    fileNamePattern: '{name}',
  });
  expect(fromByteArray).toHaveBeenCalledWith(expect.any(Uint8Array));
  const encoded = (fromByteArray as jest.Mock).mock.calls.at(
    -1,
  )?.[0] as Uint8Array;
  expect(iconv.decode(encoded, 'GB18030')).toContain('clean');
  expect(iconv.decode(encoded, 'GB18030')).not.toContain('body');
  expect(writeFile).toHaveBeenCalledWith(
    expect.stringContaining('/Same.txt'),
    'base64',
    'base64',
  );
});

test('parses EPUB chapter ranges and splits selected chapters into volumes', () => {
  expect(parseChapterScope('1-2,4,2', 4)).toEqual([0, 1, 3]);
  expect(() => parseChapterScope('4-2', 5)).toThrow('INVALID_CHAPTER_SCOPE');
  const volumeBook = {
    ...make('a'),
    chapters: Array.from({ length: 5 }, (_, index) => ({
      id: `c${index}`,
      title: `C${index + 1}`,
      content: `${index + 1}`,
    })),
  };
  const entries = bulkBookExportEntries([volumeBook], new Set(['a']), 'epub', {
    ...DEFAULT_BOOK_EXPORT_PREFERENCES,
    epubChapterScope: '2-5',
    epubChaptersPerFile: 2,
  });
  expect(entries.map(entry => entry.fileName)).toEqual([
    'Same_Author_1.epub',
    'Same_Author_2.epub',
  ]);
  expect(
    entries.map(entry => entry.book.chapters?.map(chapter => chapter.title)),
  ).toEqual([
    ['C2', 'C3'],
    ['C4', 'C5'],
  ]);
});
