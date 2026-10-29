import {
  DocumentDirectoryPath,
  copyFile,
  exists,
  hash,
  mkdir,
  readDir,
  stat,
} from '@dr.pogodin/react-native-fs';
import type { BackupPayload } from '../data/backup';
import type { BackupPreferences } from '../data/backupPreferences';
import { coverImageUri } from './bookCover';
import {
  localMediaPath,
  mapBackupMedia,
  persistedCoverFile,
  referencedBackupMedia,
  type BackupMediaIndex,
} from './backupMediaPaths';

export async function mediaFilesBelow(
  root: string,
  relative = '',
): Promise<{ source: string; relative: string }[]> {
  const result: { source: string; relative: string }[] = [];
  for (const item of await readDir(relative ? `${root}/${relative}` : root)) {
    const next = relative ? `${relative}/${item.name}` : item.name;
    if (item.isDirectory()) result.push(...(await mediaFilesBelow(root, next)));
    else if (item.isFile()) result.push({ source: item.path, relative: next });
  }
  return result;
}
const basename = (path: string) => path.slice(path.lastIndexOf('/') + 1);

/** Stage native covers wholesale by category; stage only referenced reading backgrounds. */
export async function prepareBackupMedia(
  payload: BackupPayload,
  directory: string,
  preferences: BackupPreferences,
): Promise<BackupPayload> {
  const media: BackupMediaIndex = { version: 1, references: {}, files: [] },
    paths = new Map<string, string>(),
    originalFiles = new Set<string>();
  const add = async (source: string, destination: string) => {
    if (originalFiles.has(source)) return;
    const info = await stat(source);
    if (!info.isFile()) return;
    const digest = await hash(source, 'sha256');
    const prior = paths.get(destination);
    if (prior && prior !== digest)
      throw new Error(`备份媒体文件名冲突: ${destination}`);
    if (!prior) {
      const target = `${directory}/${destination}`;
      await mkdir(target.slice(0, target.lastIndexOf('/')));
      await copyFile(source, target);
      // Hash the staged bytes, so a concurrent replacement cannot produce a false manifest.
      const copied = await stat(target),
        stagedDigest = await hash(target, 'sha256');
      if (stagedDigest !== digest || copied.size !== info.size)
        throw new Error('备份时媒体文件发生变化，请重试');
      media.files.push({ path: destination, sha256: digest, size: info.size });
      paths.set(destination, digest);
    }
    media.references[source] = destination;
    originalFiles.add(source);
  };
  const coverRoots = [`${DocumentDirectoryPath}/covers`];
  for (const name of ['LegadoImportedMedia', 'LegadoRestoredMedia']) {
    const root = `${DocumentDirectoryPath}/${name}`;
    if (await exists(root))
      for (const child of await readDir(root))
        if (child.isDirectory()) coverRoots.push(`${child.path}/covers`);
  }
  if (
    preferences.categories.persistedCovers ||
    preferences.categories.otherCovers
  )
    for (const root of coverRoots) {
      if (!(await exists(root))) continue;
      for (const file of await mediaFilesBelow(root)) {
        const persisted = persistedCoverFile(file.source);
        if (
          !(persisted
            ? preferences.categories.persistedCovers
            : preferences.categories.otherCovers)
        )
          continue;
        // Imported/restored files live in separate iOS containers. Consolidate persistent content by its actual MD5.
        const relative =
          root === coverRoots[0]
            ? file.relative
            : persisted
              ? `${await hash(file.source, 'md5')}.cover`
              : `imported-${(await hash(file.source, 'sha256')).slice(0, 24)}-${basename(file.source)}`;
        await add(file.source, `covers/${relative}`);
      }
    }
  if (preferences.categories.backgrounds)
    for (const [path, kind] of referencedBackupMedia(payload)) {
      // The picker retains images in Documents; imported media also lives below it.
      // Match native's app-owned bg root rather than following arbitrary paths from imported preferences.
      if (
        kind !== 'background' ||
        !path.startsWith(`${DocumentDirectoryPath}/`) ||
        path.split('/').includes('..') ||
        !(await exists(path))
      )
        continue;
      await add(
        path,
        `bg/${(await hash(path, 'sha256')).slice(0, 24)}-${basename(path)}`,
      );
    }
  const { media: _previous, ...snapshot } = payload;
  return { ...snapshot, ...(media.files.length ? { media } : {}) };
}

export async function restoreBackupMediaPaths(
  payload: BackupPayload,
  workingDirectory: string,
  targetDirectory: string,
): Promise<BackupPayload> {
  const index = payload.media;
  if (index)
    for (const file of index.files) {
      const path = `${workingDirectory}/${file.path}`;
      if (!(await exists(path)))
        throw new Error(`备份媒体文件缺失: ${file.path}`);
      const info = await stat(path);
      if (
        !info.isFile() ||
        info.size !== file.size ||
        (await hash(path, 'sha256')) !== file.sha256
      )
        throw new Error(`备份媒体校验失败: ${file.path}`);
    }
  const unavailable = new Set<string>();
  for (const [path, kind] of referencedBackupMedia(payload)) {
    if (
      kind === 'cover' &&
      /\/covers\/[^/]+$/.test(path) &&
      !index?.references[path] &&
      !(await exists(path))
    )
      unavailable.add(path);
  }
  const mapped = mapBackupMedia(payload, value => {
    const path = localMediaPath(value),
      relative = path && index?.references[path];
    return relative
      ? coverImageUri(`${targetDirectory}/${relative}`)
      : path && unavailable.has(path)
        ? undefined
        : value;
  });
  // Remapped runtime entries no longer carry the old device's archive references.
  const { media: _media, ...restored } = mapped;
  return restored;
}
