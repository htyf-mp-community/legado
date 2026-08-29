import { CachesDirectoryPath, DocumentDirectoryPath, copyFile, mkdir, readDir, readFile, unlink } from '@dr.pogodin/react-native-fs';
import { keepLocalCopy } from '@react-native-documents/picker';
import { getUnzip } from 'react-native-nitro-unzip';
import { convertLegacyBackup, type LegacyBackupPreview } from '../data/legacyBackup';
import { decryptLegacyBackupText } from './legacyBackupCrypto';

const clean = (uri: string) => decodeURIComponent(uri.replace(/^file:\/\//, ''));
const database = /(?:\.db(?:-(?:shm|wal))?|\.sqlite\d*)$/i;
const mediaNames = new Set(['covers', 'bg']);
const basename = (value: string) => value.replace(/\\/g, '/').split('/').pop() ?? '';
export type LegacyMediaPlan = { workingDirectory: string; targetDirectory: string; directories: string[] };
export type LegacyArchivePreview = LegacyBackupPreview & { mediaPlan?: LegacyMediaPlan };

async function filesBelow(root: string, relative = ''): Promise<Array<{ source: string; relative: string }>> {
  const output: Array<{ source: string; relative: string }> = [];
  for (const item of await readDir(relative ? `${root}/${relative}` : root)) {
    const next = relative ? `${relative}/${item.name}` : item.name;
    if (item.isDirectory()) output.push(...await filesBelow(root, next));
    else if (item.isFile()) output.push({ source: item.path, relative: next });
  }
  return output;
}

export async function activateLegacyMedia(plan: LegacyMediaPlan) {
  try {
    for (const directory of plan.directories) for (const file of await filesBelow(`${plan.workingDirectory}/${directory}`)) {
      const target = `${plan.targetDirectory}/${directory}/${file.relative}`, parent = target.slice(0, target.lastIndexOf('/'));
      await mkdir(parent); await copyFile(file.source, target);
    }
  } catch (error) { try { await unlink(plan.targetDirectory); } catch {} throw error; }
}
export async function commitLegacyMedia(plan: LegacyMediaPlan) { try { await unlink(plan.workingDirectory); } catch {} }
export async function discardLegacyMedia(plan: LegacyMediaPlan) { try { await unlink(plan.workingDirectory); } catch {} try { await unlink(plan.targetDirectory); } catch {} }

export async function inspectLegacyBackupArchive(uri: string, fileName = 'backup.zip', password = ''): Promise<LegacyArchivePreview> {
  const copies = await keepLocalCopy({ files: [{ uri, fileName }], destination: 'cachesDirectory' }), copy = copies[0];
  if (copy.status === 'error') throw new Error(copy.copyError);
  const archive = clean(copy.localUri), token = `${Date.now()}-${Math.random().toString(36).slice(2)}`, destination = `${CachesDirectoryPath}/legacy-backup-${token}`;
  try {
    await getUnzip().extract(archive, destination).await();
    const entries = await readDir(destination), files: Record<string, string> = {}, blocked: string[] = [], directories = entries.filter(item => item.isDirectory() && mediaNames.has(item.name)).map(item => item.name), targetDirectory = `${DocumentDirectoryPath}/LegadoImportedMedia/${token}`;
    const coverFiles: Record<string, string> = {}, bgFiles: Record<string, string> = {};
    if (directories.includes('covers')) for (const file of await filesBelow(`${destination}/covers`)) coverFiles[basename(file.relative)] = file.relative;
    if (directories.includes('bg')) for (const file of await filesBelow(`${destination}/bg`)) bgFiles[basename(file.relative)] = file.relative;
    for (const item of entries) {
      if (!item.isFile()) continue;
      // TODO(htyf-native): Raw Room/SQLite files stay skipped until the read-only adapter documented in docs/htyf-migration-gaps.md is pinned.
      if (database.test(item.name)) { blocked.push(item.name); continue; }
      if (item.name.toLowerCase().endsWith('.json')) {
        const raw = await readFile(item.path, 'utf8'), encrypted = ['cookies.json', 'runtimeSourceCache.json', 'servers.json'].includes(item.name) && !/^[\s]*[\[{]/.test(raw);
        if (encrypted) { try { files[item.name] = decryptLegacyBackupText(raw, password); } catch (error) { blocked.push(`${item.name}：${error instanceof Error ? error.message : String(error)}`); } }
        else files[item.name] = raw;
      }
    }
    const preview: LegacyArchivePreview = convertLegacyBackup(files, Date.now(), directories.length ? { coverRoot: `${targetDirectory}/covers`, coverFiles, bgRoot: `${targetDirectory}/bg`, bgFiles } : undefined);
    const databases = blocked.filter(item => database.test(item)), encrypted = blocked.filter(item => !database.test(item));
    if (databases.length) preview.warnings.push(`原生阻塞：未导入 Room/SQLite 数据库（${databases.join('、')}），已安全跳过；JSON 数据仍可恢复`);
    if (encrypted.length) preview.warnings.push(`未导入加密数据（${encrypted.join('；')}）`);
    if (directories.length) { preview.mediaPlan = { workingDirectory: destination, targetDirectory, directories }; preview.importedFiles.push(...directories.map(name => `${name}/`)); }
    else await unlink(destination);
    await unlink(archive);
    return preview;
  } catch (error) { try { await unlink(destination); } catch {} try { await unlink(archive); } catch {} throw error; }
}
