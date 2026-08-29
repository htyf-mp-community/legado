jest.mock('@dr.pogodin/react-native-fs', () => ({
  CachesDirectoryPath: '/app/cache',
  DocumentDirectoryPath: '/app/documents',
  readDir: jest.fn(),
  unlink: jest.fn(),
}));

import { readDir, unlink } from '@dr.pogodin/react-native-fs';
import {
  appFileParent,
  appFileRoots,
  deleteAppFile,
  filterAppFiles,
  formatFileSize,
  isPathInsideRoot,
  listAppFiles,
} from '../src/core/appFileManager';

test('normalizes roots and prevents directory traversal', async () => {
  expect(appFileRoots()).toEqual([
    { id: 'documents', path: '/app/documents' },
    { id: 'cache', path: '/app/cache' },
  ]);
  expect(isPathInsideRoot('/app/documents', '/app/documents/books/a.txt')).toBe(
    true,
  );
  expect(isPathInsideRoot('/app/documents', '/app/documents-old/a.txt')).toBe(
    false,
  );
  await expect(
    deleteAppFile('/app/documents', '/app/documents/../../outside'),
  ).rejects.toThrow('超出应用目录');
  await expect(
    deleteAppFile('/app/documents', '/app/documents'),
  ).rejects.toThrow('超出应用目录');
  expect(unlink).not.toHaveBeenCalled();
});

test('lists folders before files, filters names and stays inside its root', async () => {
  (readDir as jest.Mock).mockResolvedValue([
    {
      name: 'b.txt',
      path: '/app/documents/b.txt',
      size: 2048,
      mtime: new Date(100),
      isDirectory: () => false,
    },
    {
      name: 'Books',
      path: '/app/documents/Books',
      size: 0,
      mtime: null,
      isDirectory: () => true,
    },
  ]);
  const entries = await listAppFiles('/app/documents');
  expect(entries.map(entry => entry.name)).toEqual(['Books', 'b.txt']);
  expect(filterAppFiles(entries, 'BOOK')).toHaveLength(1);
  expect(formatFileSize(entries[1].size)).toBe('2.0 KB');
  (readDir as jest.Mock).mockResolvedValueOnce([
    {
      name: 'escape',
      path: '/outside/file',
      size: 1,
      mtime: null,
      isDirectory: () => false,
    },
  ]);
  await expect(listAppFiles('/app/documents')).rejects.toThrow('超出应用目录');
});

test('navigates to a bounded parent and deletes validated entries', async () => {
  expect(appFileParent('/app/documents', '/app/documents/books/a')).toBe(
    '/app/documents/books',
  );
  expect(appFileParent('/app/documents', '/outside')).toBe('/app/documents');
  (unlink as jest.Mock).mockResolvedValue(undefined);
  await deleteAppFile('/app/documents', '/app/documents/books/a.txt');
  expect(unlink).toHaveBeenCalledWith('/app/documents/books/a.txt');
});
