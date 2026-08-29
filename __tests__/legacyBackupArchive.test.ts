jest.mock('@dr.pogodin/react-native-fs', () => ({ CachesDirectoryPath: '/cache', DocumentDirectoryPath: '/docs', copyFile: jest.fn(), mkdir: jest.fn(), readDir: jest.fn(), readFile: jest.fn(), unlink: jest.fn() }));
jest.mock('@react-native-documents/picker', () => ({ keepLocalCopy: jest.fn() }));
jest.mock('react-native-nitro-unzip', () => ({ getUnzip: jest.fn() }));
jest.mock('react-native-mmkv', () => ({ createMMKV: () => ({ getString: jest.fn(), set: jest.fn() }) }));
jest.mock('react-native-quick-crypto', () => ({ createHash: jest.fn(), createDecipheriv: jest.fn() }));

import { copyFile, mkdir, readDir, readFile, unlink } from '@dr.pogodin/react-native-fs';
import { keepLocalCopy } from '@react-native-documents/picker';
import { getUnzip } from 'react-native-nitro-unzip';
import { activateLegacyMedia, commitLegacyMedia, inspectLegacyBackupArchive } from '../src/core/legacyBackupArchive';

test('skips raw databases visibly while importing JSON and cleaning temporary files', async () => {
  (keepLocalCopy as jest.Mock).mockResolvedValue([{ status: 'success', localUri: 'file:///cache/backup.zip' }]);
  (getUnzip as jest.Mock).mockReturnValue({ extract: () => ({ await: jest.fn().mockResolvedValue(undefined) }) });
  (readDir as jest.Mock).mockResolvedValue([
    { name: 'bookshelf.json', path: '/cache/unzip/bookshelf.json', isFile: () => true, isDirectory: () => false },
    { name: 'legado.db', path: '/cache/unzip/legado.db', isFile: () => true, isDirectory: () => false },
    { name: 'legado.db-wal', path: '/cache/unzip/legado.db-wal', isFile: () => true, isDirectory: () => false },
  ]);
  (readFile as jest.Mock).mockResolvedValue(JSON.stringify([{ name: '书', author: '作者', bookUrl: 'https://book' }]));

  const preview = await inspectLegacyBackupArchive('content://backup');

  expect(preview.importedFiles).toEqual(['bookshelf.json']);
  expect(preview.warnings.join('\n')).toContain('原生阻塞');
  expect(readFile).toHaveBeenCalledTimes(1);
  expect(unlink).toHaveBeenCalledWith('/cache/backup.zip');
});

test('stages media until confirmation and then copies it into a unique document target', async () => {
  (keepLocalCopy as jest.Mock).mockResolvedValue([{ status: 'success', localUri: 'file:///cache/media.zip' }]);
  (getUnzip as jest.Mock).mockReturnValue({ extract: () => ({ await: jest.fn().mockResolvedValue(undefined) }) });
  (readDir as jest.Mock).mockImplementation(async (path: string) => path.endsWith('/covers') ? [{ name: 'a.jpg', path: `${path}/a.jpg`, isFile: () => true, isDirectory: () => false }] : [{ name: 'bookshelf.json', path: `${path}/bookshelf.json`, isFile: () => true, isDirectory: () => false }, { name: 'covers', path: `${path}/covers`, isFile: () => false, isDirectory: () => true }]);
  (readFile as jest.Mock).mockResolvedValue(JSON.stringify([{ name: '书', bookUrl: 'b', persistedCoverUrl: '/old/covers/a.jpg' }]));
  const preview = await inspectLegacyBackupArchive('content://media');
  expect(preview.mediaPlan?.targetDirectory).toMatch(/^\/docs\/LegadoImportedMedia\//);
  const books = JSON.parse(String(preview.payload.entries['library.v1'].value));
  expect(books[0].coverUrl).toContain('/covers/a.jpg');
  await activateLegacyMedia(preview.mediaPlan!);
  expect(mkdir).toHaveBeenCalled();
  expect(copyFile).toHaveBeenCalledWith(expect.stringContaining('/covers/a.jpg'), expect.stringContaining('/covers/a.jpg'));
  await commitLegacyMedia(preview.mediaPlan!);
  expect(unlink).toHaveBeenCalledWith(preview.mediaPlan!.workingDirectory);
});
