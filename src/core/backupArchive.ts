import { inspectLegacyBackupDirectory } from './legacyBackupArchive';
import {
  CachesDirectoryPath,
  DocumentDirectoryPath,
  mkdir,
  readDir,
  readFile,
  unlink,
  writeFile,
} from '@dr.pogodin/react-native-fs';
import { keepLocalCopy, saveDocuments } from '@react-native-documents/picker';
import { getUnzip } from 'react-native-nitro-unzip';
import { createBackup, parseBackup } from '../data/backup';
import { loadBackupPreferences } from '../data/backupPreferences';
import {
  mediaFilesBelow,
  prepareBackupMedia,
  restoreBackupMediaPaths,
} from './backupMedia';
import { localMediaPath } from './backupMediaPaths';
import type { BackupPreview } from './restoreBackupPreview';
const stamp = () => new Date().toISOString().slice(0, 10);
const token = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const remove = async (path: string) => {
  try {
    await unlink(path);
  } catch {}
};
export async function createBackupArchive(raw = createBackup()) {
  const payload = parseBackup(raw),
    preferences = loadBackupPreferences(),
    directory = `${CachesDirectoryPath}/backup-${token()}`,
    path = `${directory}.zip`;
  await mkdir(directory);
  try {
    const prepared = await prepareBackupMedia(payload, directory, preferences);
    await writeFile(
      `${directory}/backup-htyf.json`,
      JSON.stringify(prepared),
      'utf8',
    );
    await getUnzip().zip(directory, path).await();
    return path;
  } catch (error) {
    await remove(path);
    throw error;
  } finally {
    await remove(directory);
  }
}
export function localBackupFileName(
  onlyLatest = loadBackupPreferences().onlyLatest,
) {
  return onlyLatest
    ? 'legado-htyf-backup.zip'
    : `legado-htyf-backup-${stamp()}.zip`;
}
export async function saveBackupArchive(raw = createBackup()) {
  const path = await createBackupArchive(raw);
  try {
    const result = await saveDocuments({
      sourceUris: [`file://${path}`],
      mimeType: 'application/zip',
      fileName: localBackupFileName(),
      copy: true,
    });
    if (result[0].error) throw new Error(result[0].error);
    return result[0];
  } finally {
    await remove(path);
  }
}
/** Takes ownership of the local archive; extracted media remains staged until explicit restore/cancel. */
export async function inspectLocalBackupArchive(
  archive: string,
  password = '',
): Promise<BackupPreview> {
  const id = token(),
    destination = `${CachesDirectoryPath}/htyf-backup-${id}`,
    target = `${DocumentDirectoryPath}/LegadoRestoredMedia/${id}`;
  try {
    await getUnzip().extract(archive, destination).await();
    const files = await readDir(destination),
      backup = files.find(
        item => item.isFile() && item.name === 'backup-htyf.json',
      );
    if (!backup) {
      const legacy = await inspectLegacyBackupDirectory(destination, password);
      return {
        raw: JSON.stringify(legacy.payload),
        payload: legacy.payload,
        mediaPlan: legacy.mediaPlan,
        legacyFiles: legacy.importedFiles,
        warnings: legacy.warnings,
      };
    }
    const original = parseBackup(await readFile(backup.path, 'utf8'));
    const directories = files
      .filter(
        item => item.isDirectory() && ['covers', 'bg'].includes(item.name),
      )
      .map(item => item.name);
    const declared = new Set(
      original.media?.files.map(file => file.path) ?? [],
    );
    for (const name of directories)
      for (const file of await mediaFilesBelow(`${destination}/${name}`))
        if (!declared.has(`${name}/${file.relative}`))
          throw new Error(`备份包含未登记的媒体文件: ${name}/${file.relative}`);
    const payload = await restoreBackupMediaPaths(
        original,
        destination,
        target,
      ),
      raw = JSON.stringify(payload);
    if (original.media?.files.length)
      return {
        raw,
        payload,
        mediaPlan: {
          workingDirectory: destination,
          targetDirectory: target,
          directories: [
            ...new Set(
              original.media.files.map(file => file.path.split('/')[0]),
            ),
          ],
        },
      };
    await remove(destination);
    return { raw, payload };
  } catch (error) {
    await remove(destination);
    throw error;
  } finally {
    await remove(archive);
  }
}
export async function inspectBackupArchive(
  uri: string,
  fileName = 'backup.zip',
): Promise<BackupPreview> {
  const copies = await keepLocalCopy({
      files: [{ uri, fileName }],
      destination: 'cachesDirectory',
    }),
    copy = copies[0];
  if (copy.status === 'error') throw new Error(copy.copyError);
  const archive = localMediaPath(copy.localUri);
  if (!archive) throw new Error('无法读取备份文件路径');
  return inspectLocalBackupArchive(archive);
}
