import {
  CachesDirectoryPath,
  DocumentDirectoryPath,
  copyFile,
  exists,
  mkdir,
  readDir,
  readFile,
  unlink,
} from '@dr.pogodin/react-native-fs';
import { keepLocalCopy } from '@react-native-documents/picker';
import { getUnzip } from 'react-native-nitro-unzip';
import {
  convertLegacyBackup,
  type LegacyBackupPreview,
} from '../data/legacyBackup';
import { decryptLegacyBackupText } from './legacyBackupCrypto';
import { preflightNativeBackupFiles } from './nativeBackupPreflight';
import { trimSourceWhitespace } from './nativeSourceUrl';
import { loadLocalPassword } from '../data/localPassword';
import {
  loadRestoreIgnore,
  type RestoreIgnore,
} from '../data/restorePreferences';

const clean = (uri: string) =>
  decodeURIComponent(uri.replace(/^file:\/\//, ''));
const database = /(?:\.db(?:-(?:shm|wal))?|\.sqlite\d*)$/i;
const mediaNames = new Set(['covers', 'bg']);
const basename = (value: string) =>
  value.replace(/\\/g, '/').split('/').pop() ?? '';
export type LegacyMediaPlan = {
  workingDirectory: string;
  targetDirectory: string;
  directories: string[];
  restoring?: boolean;
  committed?: boolean;
  discarded?: boolean;
};
export type LegacyArchivePreview = LegacyBackupPreview & {
  mediaPlan?: LegacyMediaPlan;
};

async function filesBelow(
  root: string,
  relative = '',
): Promise<Array<{ source: string; relative: string }>> {
  const output: Array<{ source: string; relative: string }> = [];
  for (const item of await readDir(relative ? `${root}/${relative}` : root)) {
    const next = relative ? `${relative}/${item.name}` : item.name;
    if (item.isDirectory()) output.push(...(await filesBelow(root, next)));
    else if (item.isFile()) output.push({ source: item.path, relative: next });
  }
  return output;
}

export async function activateLegacyMedia(
  plan: LegacyMediaPlan,
  excluded: string[] = [],
) {
  try {
    for (const directory of plan.directories)
      if (!excluded.includes(directory))
        for (const file of await filesBelow(
          `${plan.workingDirectory}/${directory}`,
        )) {
          const target = `${plan.targetDirectory}/${directory}/${file.relative}`,
            parent = target.slice(0, target.lastIndexOf('/'));
          await mkdir(parent);
          await copyFile(file.source, target);
        }
  } catch (error) {
    try {
      await unlink(plan.targetDirectory);
    } catch {}
    throw error;
  }
}
export async function commitLegacyMedia(plan: LegacyMediaPlan) {
  plan.committed = true;
  try {
    await unlink(plan.workingDirectory);
  } catch {}
}
export async function discardLegacyMedia(plan: LegacyMediaPlan) {
  if (plan.committed || plan.restoring || plan.discarded) return;
  plan.discarded = true;
  try {
    await unlink(plan.workingDirectory);
  } catch {}
  try {
    await unlink(plan.targetDirectory);
  } catch {}
}

/** Own an imported archive copy; fatal preflight errors clean extraction without changing application data. */
export async function inspectLegacyBackupArchive(
  uri: string,
  fileName = 'backup.zip',
  password = loadLocalPassword(),
  ignore: Partial<RestoreIgnore> = loadRestoreIgnore(),
): Promise<LegacyArchivePreview> {
  const copies = await keepLocalCopy({
      files: [{ uri, fileName }],
      destination: 'cachesDirectory',
    }),
    copy = copies[0];
  if (copy.status === 'error') throw new Error(copy.copyError);
  const archive = clean(copy.localUri),
    token = `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    destination = `${CachesDirectoryPath}/legacy-backup-${token}`;
  try {
    await getUnzip().extract(archive, destination).await();
    const preview = await inspectLegacyBackupDirectory(
      destination,
      password,
      token,
      ignore,
    );
    await unlink(archive);
    return preview;
  } catch (error) {
    try {
      await unlink(destination);
    } catch {}
    try {
      await unlink(archive);
    } catch {}
    throw error;
  }
}

/**
 * Inspect extracted native files using the local password unless explicitly overridden.
 * Sensitive-file preflight is fatal and precedes conversion; media stays staged until confirm.
 * The archive owner must remove `destination` if inspection throws.
 */
export async function inspectLegacyBackupDirectory(
  destination: string,
  password = loadLocalPassword(),
  token = `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  ignore: Partial<RestoreIgnore> = loadRestoreIgnore(),
): Promise<LegacyArchivePreview> {
  const entries = await readDir(destination),
    files: Record<string, string> = {},
    blocked: string[] = [],
    directories = entries
      .filter(item => item.isDirectory() && mediaNames.has(item.name))
      .map(item => item.name),
    targetDirectory = `${DocumentDirectoryPath}/LegadoImportedMedia/${token}`;
  const coverFiles: Record<string, string> = {},
    bgFiles: Record<string, string> = {};
  if (directories.includes('covers'))
    for (const file of await filesBelow(`${destination}/covers`))
      if (!file.relative.includes('/'))
        coverFiles[basename(file.relative)] = file.relative;
  if (directories.includes('bg'))
    for (const file of await filesBelow(`${destination}/bg`))
      bgFiles[basename(file.relative)] = file.relative;
  for (const item of entries) {
    if (!item.isFile()) continue;
    if (
      (ignore.ignoreCookies && item.name === 'cookies.json') ||
      (ignore.ignoreSourceVariables &&
        item.name === 'runtimeSourceCache.json') ||
      (ignore.readConfig && item.name === 'readConfig.json')
    )
      continue;
    // TODO(htyf-native): Raw Room/SQLite files stay skipped until the read-only adapter documented in docs/htyf-migration-gaps.md is pinned.
    if (database.test(item.name)) {
      blocked.push(item.name);
      continue;
    }
    if (item.name.toLowerCase().endsWith('.json')) {
      const raw = await readFile(item.path, 'utf8');
      const trimmed = trimSourceWhitespace(raw);
      // Server decrypt failures are source runCatching warnings. Cookies and runtime
      // caches instead have a fatal, ordered preflight before ordinary conversions.
      if (
        item.name === 'servers.json' &&
        !(trimmed.startsWith('[') && trimmed.endsWith(']'))
      ) {
        try {
          files[item.name] = decryptLegacyBackupText(raw, password);
        } catch (error) {
          blocked.push(
            `${item.name}：${error instanceof Error ? error.message : String(error)}`,
          );
        }
      } else files[item.name] = raw;
    }
  }
  const decoded = preflightNativeBackupFiles(files, password, ignore);
  const preview: LegacyArchivePreview = convertLegacyBackup(
    decoded,
    Date.now(),
    {
      coverRoot: `${targetDirectory}/covers`,
      coverFiles,
      existingCoverFiles: await currentCoverFiles(),
      bgRoot: `${targetDirectory}/bg`,
      bgFiles,
    },
  );
  const databases = blocked.filter(item => database.test(item)),
    encrypted = blocked.filter(item => !database.test(item));
  if (databases.length)
    preview.warnings.push(
      `原生阻塞：未导入 Room/SQLite 数据库（${databases.join('、')}），已安全跳过；JSON 数据仍可恢复`,
    );
  if (encrypted.length)
    preview.warnings.push(`未导入加密数据（${encrypted.join('；')}）`);
  if (directories.length) {
    preview.mediaPlan = {
      workingDirectory: destination,
      targetDirectory,
      directories,
    };
    preview.importedFiles.push(...directories.map(name => `${name}/`));
  } else await unlink(destination);
  return preview;
}

async function currentCoverFiles() {
  const result: Record<string, string> = {};
  const root = `${DocumentDirectoryPath}/covers`;
  if (await exists(root))
    for (const file of await readDir(root))
      if (file.isFile()) result[file.name] = file.path;
  return result;
}
