jest.mock('@dr.pogodin/react-native-fs', () => ({
  CachesDirectoryPath: '/cache',
  DocumentDirectoryPath: '/docs',
  mkdir: jest.fn(),
  readDir: jest.fn(),
  readFile: jest.fn(async () => 'raw'),
  unlink: jest.fn(),
  writeFile: jest.fn(),
}));
jest.mock('@react-native-documents/picker', () => ({
  keepLocalCopy: jest.fn(async () => [
    { status: 'success', localUri: 'file:///cache/copied.zip' },
  ]),
  saveDocuments: jest.fn(),
}));
const mockZip = jest.fn(),
  mockExtract = jest.fn();
jest.mock('react-native-nitro-unzip', () => ({
  getUnzip: () => ({
    zip: () => ({ await: mockZip }),
    extract: () => ({ await: mockExtract }),
  }),
}));
jest.mock('../src/data/backup', () => ({
  createBackup: () => 'raw',
  parseBackup: jest.fn(() => ({ entries: {} })),
}));
jest.mock('../src/data/backupPreferences', () => ({
  loadBackupPreferences: () => ({ onlyLatest: true }),
}));
jest.mock('../src/data/localPassword', () => ({
  loadLocalPassword: () => 'fixture-password',
}));
jest.mock('../src/core/backupMedia', () => ({
  prepareBackupMedia: jest.fn(async value => value),
  restoreBackupMediaPaths: jest.fn(async value => value),
  mediaFilesBelow: jest.fn(async () => []),
}));
jest.mock('../src/core/legacyBackupArchive', () => ({
  inspectLegacyBackupDirectory: jest.fn(async () => ({
    payload: { entries: {} },
    importedFiles: ['bookshelf.json'],
    warnings: [],
  })),
}));
import { readDir, unlink, writeFile } from '@dr.pogodin/react-native-fs';
import { saveDocuments } from '@react-native-documents/picker';
import { parseBackup } from '../src/data/backup';
import {
  mediaFilesBelow,
  restoreBackupMediaPaths,
} from '../src/core/backupMedia';
import { inspectLegacyBackupDirectory } from '../src/core/legacyBackupArchive';
import {
  createBackupArchive,
  inspectLocalBackupArchive,
  saveBackupArchive,
} from '../src/core/backupArchive';
const item = (name: string, directory = false) => ({
  name,
  path: '/extracted/' + name,
  isDirectory: () => directory,
  isFile: () => !directory,
});
beforeEach(() => {
  jest.clearAllMocks();
  mockZip.mockResolvedValue({});
  mockExtract.mockResolvedValue({});
  (readDir as jest.Mock).mockResolvedValue([item('backup-htyf.json')]);
  (parseBackup as jest.Mock).mockReturnValue({ entries: {} });
  (mediaFilesBelow as jest.Mock).mockResolvedValue([]);
  (restoreBackupMediaPaths as jest.Mock).mockImplementation(
    async value => value,
  );
});
test('writes the prepared metadata beside the media before creating a unique ZIP', async () => {
  const a = await createBackupArchive(),
    b = await createBackupArchive();
  expect(a).not.toBe(b);
  expect(writeFile).toHaveBeenCalledWith(
    expect.stringMatching(/\/backup-htyf.json$/),
    JSON.stringify({ entries: {} }),
    'utf8',
  );
  expect(unlink).toHaveBeenCalledWith(a.replace(/\.zip$/, ''));
  expect(unlink).not.toHaveBeenCalledWith(a);
});
test('ZIP creation failure removes both the staging directory and partial archive', async () => {
  mockZip.mockRejectedValueOnce(new Error('disk'));
  await expect(createBackupArchive()).rejects.toThrow('disk');
  expect(
    (unlink as jest.Mock).mock.calls.some(([path]) => path.endsWith('.zip')),
  ).toBe(true);
  expect(
    (unlink as jest.Mock).mock.calls.some(([path]) => !path.endsWith('.zip')),
  ).toBe(true);
});
test('cancelling the file provider still removes the generated ZIP', async () => {
  (saveDocuments as jest.Mock).mockRejectedValueOnce(new Error('cancelled'));
  await expect(saveBackupArchive()).rejects.toThrow('cancelled');
  expect(
    (unlink as jest.Mock).mock.calls.some(([path]) => path.endsWith('.zip')),
  ).toBe(true);
});
test('media inspection keeps extracted files staged, with no destination writes before confirmation', async () => {
  (parseBackup as jest.Mock).mockReturnValue({
    entries: {},
    media: { files: [{ path: 'covers/a' }] },
  });
  (readDir as jest.Mock).mockResolvedValue([
    item('backup-htyf.json'),
    item('covers', true),
  ]);
  const result = await inspectLocalBackupArchive('/cache/download.zip');
  expect(result.mediaPlan?.targetDirectory).toMatch(
    /^\/docs\/LegadoRestoredMedia\//,
  );
  expect(unlink).toHaveBeenCalledWith('/cache/download.zip');
  expect(unlink).not.toHaveBeenCalledWith(result.mediaPlan!.workingDirectory);
});
test('digest failure removes extracted and downloaded temporary files', async () => {
  (restoreBackupMediaPaths as jest.Mock).mockRejectedValueOnce(
    new Error('digest'),
  );
  await expect(
    inspectLocalBackupArchive('/cache/download.zip'),
  ).rejects.toThrow('digest');
  expect(unlink).toHaveBeenCalledWith('/cache/download.zip');
  expect(
    (unlink as jest.Mock).mock.calls.some(([path]) =>
      path.includes('/htyf-backup-'),
    ),
  ).toBe(true);
});
test('unregistered media is rejected instead of copying unverified extra files', async () => {
  (readDir as jest.Mock).mockResolvedValue([
    item('backup-htyf.json'),
    item('covers', true),
  ]);
  (mediaFilesBelow as jest.Mock).mockResolvedValueOnce([
    { relative: 'extra', source: '/extra' },
  ]);
  await expect(
    inspectLocalBackupArchive('/cache/download.zip'),
  ).rejects.toThrow('未登记');
});
test('native Android ZIPs use the legacy converter and retain warnings and staged media', async () => {
  (readDir as jest.Mock).mockResolvedValue([item('bookshelf.json')]);
  const result = await inspectLocalBackupArchive(
    '/cache/native.zip',
    'password',
  );
  expect(inspectLegacyBackupDirectory).toHaveBeenCalledWith(
    expect.any(String),
    'password',
  );
  expect(result.legacyFiles).toEqual(['bookshelf.json']);
});

test('ordinary native ZIP inspection uses the current local password by default', async () => {
  (readDir as jest.Mock).mockResolvedValue([item('bookshelf.json')]);
  const result = await inspectLocalBackupArchive('/cache/native.zip');
  expect(inspectLegacyBackupDirectory).toHaveBeenCalledWith(
    expect.any(String),
    'fixture-password',
  );
  expect(result.legacyFiles).toEqual(['bookshelf.json']);
});
