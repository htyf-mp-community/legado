jest.mock('@dr.pogodin/react-native-fs', () => ({
  CachesDirectoryPath: '/cache',
  downloadFile: jest.fn(),
  uploadFiles: jest.fn(),
  unlink: jest.fn(),
}));
jest.mock('../src/data/backup', () => ({
  createBackup: () => 'raw',
  parseBackup: () => ({ format: 'legado-htyf-backup' }),
}));
jest.mock('../src/data/backupPreferences', () => ({
  loadBackupPreferences: () => ({ onlyLatest: true, deviceName: 'phone' }),
}));
jest.mock('../src/data/localPassword', () => ({
  loadLocalPassword: () => 'local-password',
}));
jest.mock('../src/core/backupArchive', () => ({
  createBackupArchive: jest.fn(async () => '/cache/created.zip'),
  inspectLocalBackupArchive: jest.fn(async () => ({
    raw: 'parsed',
    payload: {},
  })),
}));
jest.mock('../src/data/remoteBackup', () => ({
  normalizeWebDavConfig: (config: unknown) => config,
  webDavBackupUrl: () => 'https://dav.test/legado/backup-htyf.json',
  webDavAuthorization: () => ({ Authorization: 'Basic fixture' }),
  ensureWebDavDirectory: jest.fn(),
  listWebDavBackups: jest.fn(async () => []),
  downloadWebDavBackupEntry: jest.fn(async () => 'legacy-json'),
}));
import { downloadFile, unlink, uploadFiles } from '@dr.pogodin/react-native-fs';
import {
  createBackupArchive,
  inspectLocalBackupArchive,
} from '../src/core/backupArchive';
import {
  downloadWebDavBackupEntry,
  ensureWebDavDirectory,
  listWebDavBackups,
} from '../src/data/remoteBackup';
import {
  inspectLatestWebDavBackup,
  inspectWebDavBackupEntry,
  uploadWebDavArchive,
} from '../src/core/remoteBackupArchive';
const config = {
    url: 'https://dav.test/',
    directory: 'legado',
    username: 'u',
    password: 'p',
  },
  entry = {
    name: 'backup.zip',
    url: 'https://dav.test/legado/backup.zip',
    modifiedAt: 0,
  };
beforeEach(() => {
  jest.clearAllMocks();
  (downloadFile as jest.Mock).mockReturnValue({
    promise: Promise.resolve({ statusCode: 200 }),
  });
  (uploadFiles as jest.Mock).mockReturnValue({
    promise: Promise.resolve({ statusCode: 201 }),
  });
  (ensureWebDavDirectory as jest.Mock).mockResolvedValue(undefined);
  (listWebDavBackups as jest.Mock).mockResolvedValue([]);
});
test('uploads real ZIP file bytes with PUT rather than wrapping binary in multipart data', async () => {
  await uploadWebDavArchive(
    config,
    'snapshot',
    'backup2026-10-28-我的设备.zip',
  );
  expect(createBackupArchive).toHaveBeenCalledWith('snapshot');
  expect(uploadFiles).toHaveBeenCalledWith(
    expect.objectContaining({
      method: 'PUT',
      binaryStreamOnly: true,
      toUrl: expect.stringContaining(
        '%E6%88%91%E7%9A%84%E8%AE%BE%E5%A4%87.zip',
      ),
      headers: {
        Authorization: 'Basic fixture',
        'Content-Type': 'application/zip',
      },
      files: [expect.objectContaining({ filepath: '/cache/created.zip' })],
    }),
  );
  expect(unlink).toHaveBeenCalledWith('/cache/created.zip');
});
test.each(['directory', 'http'])(
  '%s upload failure still removes its temporary ZIP',
  async stage => {
    if (stage === 'directory')
      (ensureWebDavDirectory as jest.Mock).mockRejectedValueOnce(
        new Error('MKCOL failed'),
      );
    else
      (uploadFiles as jest.Mock).mockReturnValueOnce({
        promise: Promise.resolve({ statusCode: 500 }),
      });
    await expect(uploadWebDavArchive(config)).rejects.toThrow();
    expect(unlink).toHaveBeenCalledWith('/cache/created.zip');
  },
);
test('downloads ZIP into a unique local file and inspects it with the local password', async () => {
  expect((await inspectWebDavBackupEntry(config, entry)).raw).toBe('parsed');
  const options = (downloadFile as jest.Mock).mock.calls[0][0];
  expect(options).toMatchObject({
    fromUrl: entry.url,
    cacheable: false,
    headers: { Authorization: 'Basic fixture' },
  });
  expect(inspectLocalBackupArchive).toHaveBeenCalledWith(
    options.toFile,
    'local-password',
  );
  expect(unlink).toHaveBeenCalledWith(options.toFile);
});
test('a failed or foreign download never reaches the archive inspector', async () => {
  await expect(
    inspectWebDavBackupEntry(config, {
      ...entry,
      url: 'https://other.test/legado/backup.zip',
    }),
  ).rejects.toThrow('目录');
  expect(downloadFile).not.toHaveBeenCalled();
  (downloadFile as jest.Mock).mockReturnValueOnce({
    promise: Promise.resolve({ statusCode: 403 }),
  });
  await expect(inspectWebDavBackupEntry(config, entry)).rejects.toThrow('403');
  expect(inspectLocalBackupArchive).not.toHaveBeenCalled();
});
test('old JSON backups remain downloadable without attempting ZIP extraction', async () => {
  const json = {
    ...entry,
    name: 'backup-htyf.json',
    url: 'https://dav.test/legado/backup-htyf.json',
  };
  expect((await inspectWebDavBackupEntry(config, json)).raw).toBe(
    'legacy-json',
  );
  expect(downloadWebDavBackupEntry).toHaveBeenCalledWith(config, json);
  expect(downloadFile).not.toHaveBeenCalled();
});
test('manual download uses the newest listed archive, including native backup.zip', async () => {
  (listWebDavBackups as jest.Mock).mockResolvedValueOnce([entry]);
  await inspectLatestWebDavBackup(config);
  expect(downloadFile).toHaveBeenCalledWith(
    expect.objectContaining({ fromUrl: entry.url }),
  );
});
test('missing stable ZIP falls back to old JSON while other HTTP failures remain visible', async () => {
  (downloadFile as jest.Mock).mockReturnValueOnce({
    promise: Promise.resolve({ statusCode: 404 }),
  });
  expect((await inspectLatestWebDavBackup(config)).raw).toBe('legacy-json');
  (downloadFile as jest.Mock).mockReturnValueOnce({
    promise: Promise.resolve({ statusCode: 500 }),
  });
  await expect(inspectLatestWebDavBackup(config)).rejects.toThrow('500');
  expect(downloadWebDavBackupEntry).toHaveBeenCalledTimes(1);
});
