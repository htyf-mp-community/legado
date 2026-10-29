import {
  CachesDirectoryPath,
  downloadFile,
  unlink,
  uploadFiles,
} from '@dr.pogodin/react-native-fs';
import { createBackup, parseBackup } from '../data/backup';
import { loadBackupPreferences } from '../data/backupPreferences';
import { loadLocalPassword } from '../data/localPassword';
import {
  downloadWebDavBackupEntry,
  listWebDavBackups,
  ensureWebDavDirectory,
  normalizeWebDavConfig,
  webDavAuthorization,
  webDavBackupUrl,
  type RemoteBackupEntry,
  type WebDavCredentials,
} from '../data/remoteBackup';
import {
  createBackupArchive,
  inspectLocalBackupArchive,
} from './backupArchive';
import type { BackupPreview } from './restoreBackupPreview';
import { backupArchiveFileName } from './backupArchiveNaming';
const ZIP_NAME = 'backup-htyf.zip';
const directory = (config: WebDavCredentials) =>
  webDavBackupUrl(config).replace(/[^/]+$/, '');
const remove = async (path: string) => {
  try {
    await unlink(path);
  } catch {}
};
export async function uploadWebDavArchive(
  config: WebDavCredentials,
  raw = createBackup(),
  name = remoteArchiveFileName(loadBackupPreferences().deviceName),
) {
  const normalized = normalizeWebDavConfig(config),
    path = await createBackupArchive(raw);
  try {
    await ensureWebDavDirectory(normalized);
    const safe = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_');
    const result = await uploadFiles({
      toUrl: `${directory(normalized)}${encodeURIComponent(safe)}`,
      method: 'PUT',
      binaryStreamOnly: true,
      headers: {
        ...webDavAuthorization(normalized),
        'Content-Type': 'application/zip',
      },
      files: [
        {
          name: 'backup',
          filename: safe,
          filepath: path,
          filetype: 'application/zip',
        },
      ],
    }).promise;
    if (result.statusCode < 200 || result.statusCode >= 300)
      throw new Error(`WebDAV HTTP ${result.statusCode}`);
    return result;
  } finally {
    await remove(path);
  }
}
export async function inspectWebDavBackupEntry(
  config: WebDavCredentials,
  entry: RemoteBackupEntry,
): Promise<BackupPreview> {
  const root = new URL(directory(config)),
    url = new URL(entry.url);
  if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname))
    throw new Error('备份不在当前 WebDAV 目录内');
  if (/\.json$/i.test(entry.name)) {
    const raw = await downloadWebDavBackupEntry(config, entry);
    return { raw, payload: parseBackup(raw) };
  }
  const path = `${CachesDirectoryPath}/webdav-backup-${Date.now()}-${Math.random().toString(36).slice(2)}.zip`;
  try {
    const result = await downloadFile({
      fromUrl: url.toString(),
      toFile: path,
      headers: webDavAuthorization(config),
      cacheable: false,
      readTimeout: 60000,
    }).promise;
    if (result.statusCode < 200 || result.statusCode >= 300)
      throw Object.assign(new Error(`WebDAV HTTP ${result.statusCode}`), {
        statusCode: result.statusCode,
      });
    return await inspectLocalBackupArchive(path, loadLocalPassword());
  } finally {
    await remove(path);
  }
}
export async function inspectLatestWebDavBackup(
  config: WebDavCredentials,
): Promise<BackupPreview> {
  const root = directory(config),
    entries = await listWebDavBackups(config);
  if (entries.length) return inspectWebDavBackupEntry(config, entries[0]);
  try {
    return await inspectWebDavBackupEntry(config, {
      name: ZIP_NAME,
      url: root + ZIP_NAME,
      modifiedAt: 0,
    });
  } catch (error) {
    if (
      !(
        error &&
        typeof error === 'object' &&
        'statusCode' in error &&
        error.statusCode === 404
      )
    )
      throw error;
    return inspectWebDavBackupEntry(config, {
      name: 'backup-htyf.json',
      url: webDavBackupUrl(config),
      modifiedAt: 0,
    });
  }
}
export function remoteArchiveFileName(deviceName: string, now = Date.now()) {
  return backupArchiveFileName(
    loadBackupPreferences().onlyLatest,
    deviceName,
    now,
  );
}
