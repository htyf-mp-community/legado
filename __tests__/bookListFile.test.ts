jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(),
  keepLocalCopy: jest.fn(),
  saveDocuments: jest.fn(),
  types: { json: 'public.json', plainText: 'public.plain-text' },
}));
jest.mock('@dr.pogodin/react-native-fs', () => ({
  TemporaryDirectoryPath: '/tmp',
  mkdir: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  unlink: jest.fn(),
}));
import {
  pick,
  keepLocalCopy,
  saveDocuments,
} from '@react-native-documents/picker';
import {
  mkdir,
  readFile,
  writeFile,
  unlink,
} from '@dr.pogodin/react-native-fs';
import { pickBookListText, saveBookList } from '../src/core/bookListFile';
beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(mkdir).mockResolvedValue(undefined);
  jest.mocked(writeFile).mockResolvedValue(undefined);
  jest.mocked(unlink).mockResolvedValue(undefined);
});
test('iOS export source is named books.json, contains only native list fields, and is cleaned after save', async () => {
  jest
    .mocked(saveDocuments)
    .mockResolvedValue([
      { uri: 'file:///saved/books.json', name: 'books.json', error: null },
    ]);
  await expect(
    saveBookList([
      {
        id: 'private',
        name: '书名',
        author: '作者',
        intro: '简介',
        chapterTitle: 'private chapter',
        content: 'private body',
        progress: 0.6,
        updatedAt: 1,
        groupIds: ['1'],
        bookUrl: 'https://private.example/book',
      },
    ]),
  ).resolves.toMatchObject({ uri: 'file:///saved/books.json' });
  const [path, body, encoding] = jest.mocked(writeFile).mock.calls[0];
  expect(path).toMatch(/^\/tmp\/book-list-[^/]+\/books\.json$/);
  expect(JSON.parse(String(body))).toEqual([
    { name: '书名', author: '作者', intro: '简介' },
  ]);
  expect(encoding).toBe('utf8');
  expect(saveDocuments).toHaveBeenCalledWith(
    expect.objectContaining({ sourceUris: [`file://${path}`], copy: true }),
  );
  expect(unlink).toHaveBeenCalledWith(
    String(path).slice(0, -'/books.json'.length),
  );
});
test('cancelled or failed native export cleans the temporary directory and preserves the original error', async () => {
  const cancelled = new Error('cancelled');
  jest.mocked(saveDocuments).mockRejectedValue(cancelled);
  await expect(saveBookList([])).rejects.toBe(cancelled);
  expect(unlink).toHaveBeenCalledTimes(1);
  jest
    .mocked(saveDocuments)
    .mockResolvedValue([{ uri: '', name: null, error: 'No space' }]);
  await expect(saveBookList([])).rejects.toThrow('No space');
  expect(unlink).toHaveBeenCalledTimes(2);
});
test('security-scoped import reads a local UTF-8 copy and removes it even when reading fails', async () => {
  jest
    .mocked(pick)
    .mockResolvedValue([
      { uri: 'file:///external/books.json', name: 'books.json' } as never,
    ]);
  jest
    .mocked(keepLocalCopy)
    .mockResolvedValue([
      {
        status: 'success',
        sourceUri: 'file:///external/books.json',
        localUri: 'file:///cache/book%20list.json',
      },
    ]);
  jest.mocked(readFile).mockRejectedValue(new Error('Unreadable'));
  await expect(pickBookListText()).rejects.toThrow('Unreadable');
  expect(readFile).toHaveBeenCalledWith('/cache/book list.json', 'utf8');
  expect(unlink).toHaveBeenCalledWith('/cache/book list.json');
});
