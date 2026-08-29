import { Image } from 'react-native';
import { keepLocalCopy, pick, saveDocuments } from '@react-native-documents/picker';
import { CachesDirectoryPath, DocumentDirectoryPath, copyFile, mkdir, readDir, stat, unlink } from '@dr.pogodin/react-native-fs';
import { getUnzip } from 'react-native-nitro-unzip';
import { BOTTOM_BAR_SKIN_SLOTS, type BottomBarSkin, type BottomBarSkinAssignment, type BottomBarSkinSlot, sanitizeBottomBarSkinName, uniqueBottomBarSkinName } from '../data/bottomBarSkins';

const IMAGE = /\.(?:png|jpe?g|webp|bmp|gif)$/i;
export const BOTTOM_BAR_SKIN_ARCHIVE_LIMITS = { archiveBytes: 16 * 1024 * 1024, entries: 64, entryBytes: 8 * 1024 * 1024, totalBytes: 32 * 1024 * 1024, dimension: 8192, pixels: 32 * 1024 * 1024 };
const clean = (value: string) => value.startsWith('file://') ? decodeURIComponent(value.slice(7)) : value;
export type BottomBarSkinStage = { directory: string; archive: string; images: string[] };

export async function inspectBottomBarSkinDirectory(root: string) {
  const images: string[] = [], queue = [root];
  let entries = 0, total = 0;
  while (queue.length) {
    const directory = queue.shift()!;
    for (const item of await readDir(directory)) {
      entries += 1;
      if (entries > BOTTOM_BAR_SKIN_ARCHIVE_LIMITS.entries) throw new Error('皮肤 ZIP 条目过多');
      if (item.isDirectory()) queue.push(item.path);
      else {
        const size = Number(item.size) || 0;
        if (size > BOTTOM_BAR_SKIN_ARCHIVE_LIMITS.entryBytes) throw new Error('皮肤图片超过 8 MiB');
        total += size;
        if (total > BOTTOM_BAR_SKIN_ARCHIVE_LIMITS.totalBytes) throw new Error('皮肤解压内容超过 32 MiB');
        if (IMAGE.test(item.name) && size > 0) images.push(item.path);
      }
    }
  }
  if (!images.length) throw new Error('ZIP 中没有可用图片');
  return images.sort((a, b) => a.localeCompare(b));
}

export async function pickAndStageBottomBarSkin(): Promise<BottomBarSkinStage> {
  const [file] = await pick({ type: ['application/zip'], allowMultiSelection: false, mode: 'import' });
  const [copy] = await keepLocalCopy({ files: [{ uri: file.uri, fileName: file.name ?? 'bottom-bar-skin.zip' }], destination: 'cachesDirectory' });
  if (copy.status === 'error') throw new Error(copy.copyError);
  const archive = clean(copy.localUri), directory = `${CachesDirectoryPath}/bottom-bar-skin-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    if (Number((await stat(archive)).size) > BOTTOM_BAR_SKIN_ARCHIVE_LIMITS.archiveBytes) throw new Error('皮肤 ZIP 超过 16 MiB');
    const result = await getUnzip().extract(archive, directory).await();
    if (!result.success) throw new Error('无法解压皮肤 ZIP');
    const candidates = await inspectBottomBarSkinDirectory(directory), images: string[] = [];
    for (const path of candidates) {
      try {
        const size = await Image.getSize(`file://${path}`);
        if (size.width > 0 && size.height > 0 && size.width <= BOTTOM_BAR_SKIN_ARCHIVE_LIMITS.dimension && size.height <= BOTTOM_BAR_SKIN_ARCHIVE_LIMITS.dimension && size.width * size.height <= BOTTOM_BAR_SKIN_ARCHIVE_LIMITS.pixels) images.push(path);
      } catch { await unlink(path).catch(() => undefined); }
    }
    if (!images.length) throw new Error('ZIP 中没有可解码图片');
    return { directory, archive, images };
  } catch (error) {
    await discardBottomBarSkinStage({ directory, archive });
    throw error;
  }
}

export async function discardBottomBarSkinStage(stage: Pick<BottomBarSkinStage, 'directory' | 'archive'>) {
  await unlink(stage.directory).catch(() => undefined);
  await unlink(stage.archive).catch(() => undefined);
}

export async function persistBottomBarSkin(name: string, assignments: Partial<Record<BottomBarSkinSlot, BottomBarSkinAssignment>>, existing: BottomBarSkin[], editName?: string) {
  const valid = Object.entries(assignments).filter((entry): entry is [BottomBarSkinSlot, BottomBarSkinAssignment] => BOTTOM_BAR_SKIN_SLOTS.includes(entry[0] as BottomBarSkinSlot) && !!entry[1]?.selected);
  if (!valid.length) throw new Error('至少为一个底栏槽位选择选中态图片');
  const finalName = editName && sanitizeBottomBarSkinName(name) === editName ? editName : uniqueBottomBarSkinName(name, existing.map(item => item.name).filter(item => item !== editName));
  const token = encodeURIComponent(finalName), root = `${DocumentDirectoryPath}/bottom-bar-skins`, target = `${root}/${token}`, temp = `${root}/.save-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await mkdir(temp);
  try {
    const saved: BottomBarSkin['assignments'] = {};
    for (const [slot, assignment] of valid) {
      const selected = `${temp}/${slot}_selected${assignment.selected.match(/\.[^.]+$/)?.[0]?.toLowerCase() || '.png'}`;
      await copyFile(assignment.selected, selected);
      saved[slot] = { selected: selected.replace(temp, target) };
      if (assignment.normal) {
        const normal = `${temp}/${slot}_normal${assignment.normal.match(/\.[^.]+$/)?.[0]?.toLowerCase() || '.png'}`;
        await copyFile(assignment.normal, normal);
        saved[slot]!.normal = normal.replace(temp, target);
      }
    }
    await unlink(target).catch(() => undefined);
    await mkdir(root);
    // RNFS moveFile is not uniformly available in the configured wrapper; copy
    // the bounded canonical set into its final directory transactionally.
    await mkdir(target);
    for (const assignment of Object.values(saved)) {
      if (!assignment) continue;
      const tempSelected = assignment.selected.replace(target, temp);
      await copyFile(tempSelected, assignment.selected);
      if (assignment.normal) await copyFile(assignment.normal.replace(target, temp), assignment.normal);
    }
    const old = existing.find(item => item.name === editName);
    return { name: finalName, assignments: saved, createdAt: old?.createdAt ?? Date.now(), updatedAt: Date.now() } satisfies BottomBarSkin;
  } finally { await unlink(temp).catch(() => undefined); }
}

export async function deleteBottomBarSkinAssets(skin: BottomBarSkin) {
  const first = Object.values(skin.assignments).find(Boolean)?.selected;
  if (first) await unlink(first.substring(0, first.lastIndexOf('/'))).catch(() => undefined);
}

export async function exportBottomBarSkin(skin: BottomBarSkin) {
  const directory = `${CachesDirectoryPath}/bottom-bar-skin-export-${Date.now()}`, archive = `${CachesDirectoryPath}/${sanitizeBottomBarSkinName(skin.name)}.zip`;
  await mkdir(directory);
  try {
    for (const [slot, assignment] of Object.entries(skin.assignments)) {
      if (!assignment) continue;
      await copyFile(assignment.selected, `${directory}/${slot}_selected.png`);
      if (assignment.normal) await copyFile(assignment.normal, `${directory}/${slot}_normal.png`);
    }
    const result = await getUnzip().zip(directory, archive).await();
    if (!result.success) throw new Error('无法创建皮肤 ZIP');
    const saved = await saveDocuments({ sourceUris: [`file://${archive}`], mimeType: 'application/zip', fileName: `${sanitizeBottomBarSkinName(skin.name)}.zip`, copy: true });
    if (saved[0]?.error) throw new Error(saved[0].error);
    return saved[0];
  } finally { await unlink(directory).catch(() => undefined); await unlink(archive).catch(() => undefined); }
}
