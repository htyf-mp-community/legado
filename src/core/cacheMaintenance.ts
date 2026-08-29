import {
  CachesDirectoryPath,
  exists,
  readDir,
  unlink,
} from '@dr.pogodin/react-native-fs';
import { appStorage } from '../data/storage';

type Entry = {
  path: string;
  size: string | number;
  isDirectory: () => boolean;
  isFile: () => boolean;
  mtime?:Date|null;
};
type Fs = {
  exists: (path: string) => Promise<boolean>;
  readDir: (path: string) => Promise<Entry[]>;
  unlink: (path: string) => Promise<void>;
};
const nativeFs: Fs = { exists, readDir, unlink };

function isDirectChild(root: string, path: string) {
  const prefix = `${root.replace(/\/+$/, '')}/`;
  return path.startsWith(prefix) && !path.slice(prefix.length).includes('/');
}

async function entrySize(entry: Entry, fs: Fs): Promise<number> {
  if (entry.isFile()) return Math.max(0, Number(entry.size) || 0);
  if (!entry.isDirectory()) return 0;
  const children = await fs.readDir(entry.path);
  const sizes = await Promise.all(children.map(child => entrySize(child, fs)));
  return sizes.reduce((sum, value) => sum + value, 0);
}

export async function cacheStats(fs: Fs = nativeFs, root = CachesDirectoryPath) {
  if (!(await fs.exists(root))) return { bytes: 0, entries: 0 };
  const entries = await fs.readDir(root);
  const sizes = await Promise.all(entries.map(entry => entrySize(entry, fs)));
  return {
    bytes: sizes.reduce((sum, value) => sum + value, 0),
    entries: entries.length,
  };
}

export async function clearApplicationCache(
  fs: Fs = nativeFs,
  root = CachesDirectoryPath,
) {
  if (!(await fs.exists(root))) return { bytes: 0, entries: 0 };
  const entries = await fs.readDir(root);
  if (entries.some(entry => !isDirectChild(root, entry.path)))
    throw new Error('缓存目录包含越界条目，已停止清理');
  const sizes = await Promise.all(entries.map(entry => entrySize(entry, fs)));
  for (const entry of entries) await fs.unlink(entry.path);
  return {
    bytes: sizes.reduce((sum, value) => sum + value, 0),
    entries: entries.length,
  };
}

export async function clearExpiredApplicationCache(maxAgeMs=7*24*60*60*1000,now=Date.now(),fs:Fs=nativeFs,root=CachesDirectoryPath){if(!(await fs.exists(root)))return{entries:0};const entries=await fs.readDir(root);if(entries.some(entry=>!isDirectChild(root,entry.path)))throw new Error('缓存目录包含越界条目，已停止清理');let removed=0;for(const entry of entries){const modified=entry.mtime?.getTime();if(modified!==undefined&&Number.isFinite(modified)&&modified+maxAgeMs<now){await fs.unlink(entry.path);removed++}}return{entries:removed}}

export function compactApplicationStorage() {
  appStorage.trim();
}
