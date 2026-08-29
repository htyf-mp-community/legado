import {
  CachesDirectoryPath,
  DocumentDirectoryPath,
  readDir,
  unlink,
} from '@dr.pogodin/react-native-fs';

export type AppFileRoot = {
  id: 'documents' | 'cache';
  path: string;
};
export type AppFileEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt?: number;
};

const normalize = (value: string) => {
  const output: string[] = [];
  for (const part of value.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') output.pop();
    else output.push(part);
  }
  return `/${output.join('/')}`;
};

export const appFileRoots = (): AppFileRoot[] => [
  { id: 'documents', path: normalize(DocumentDirectoryPath) },
  { id: 'cache', path: normalize(CachesDirectoryPath) },
];

export function isPathInsideRoot(root: string, target: string) {
  const base = normalize(root),
    path = normalize(target);
  return path === base || path.startsWith(`${base}/`);
}

export function appFileParent(root: string, current: string) {
  const base = normalize(root),
    path = normalize(current);
  if (!isPathInsideRoot(base, path) || path === base) return base;
  const parent = path.slice(0, path.lastIndexOf('/')) || '/';
  return isPathInsideRoot(base, parent) ? parent : base;
}

const assertInside = (root: string, target: string, allowRoot = true) => {
  const base = normalize(root),
    path = normalize(target);
  if (!isPathInsideRoot(base, path) || (!allowRoot && base === path))
    throw new Error('文件路径超出应用目录');
  return path;
};

export async function listAppFiles(root: string, directory = root) {
  const path = assertInside(root, directory),
    items = await readDir(path);
  return items
    .map(
      (item): AppFileEntry => ({
        name: item.name,
        path: assertInside(root, item.path),
        isDirectory: item.isDirectory(),
        size: Number(item.size) || 0,
        modifiedAt: item.mtime ? new Date(item.mtime).getTime() : undefined,
      }),
    )
    .sort(
      (left, right) =>
        Number(left.isDirectory === false) -
          Number(right.isDirectory === false) ||
        left.name.localeCompare(right.name),
    );
}

export async function deleteAppFile(root: string, target: string) {
  const path = assertInside(root, target, false);
  await unlink(path);
}

export const filterAppFiles = (entries: AppFileEntry[], query: string) => {
  const key = query.trim().toLocaleLowerCase();
  return key
    ? entries.filter(entry => entry.name.toLocaleLowerCase().includes(key))
    : entries;
};

export function formatFileSize(value: number) {
  if (value < 1024) return `${Math.max(0, value)} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}
