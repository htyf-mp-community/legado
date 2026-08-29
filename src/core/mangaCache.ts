import {
  CachesDirectoryPath,
  DocumentDirectoryPath,
  copyFile,
  downloadFile,
  exists,
  mkdir,
  readDir,
  unlink,
} from '@dr.pogodin/react-native-fs';

const ROOT = `${CachesDirectoryPath}/legado-manga`;
export function stableCacheKey(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
const extension = (url: string) =>
  url.match(/\.([a-z0-9]{2,5})(?:[?#]|$)/i)?.[1]?.toLowerCase() ?? 'img';
export function mangaCachePath(bookId: string, uri: string) {
  return `${ROOT}/${stableCacheKey(bookId)}/${stableCacheKey(uri)}.${extension(uri)}`;
}
export async function cachedMangaUri(bookId: string, uri: string) {
  const path = mangaCachePath(bookId, uri);
  return (await exists(path)) ? `file://${path}` : '';
}
export async function cacheMangaImage(
  bookId: string,
  uri: string,
  headers: Record<string, string> = {},
) {
  const path = mangaCachePath(bookId, uri);
  if (await exists(path)) return `file://${path}`;
  await mkdir(path.slice(0, path.lastIndexOf('/')));
  const result = await downloadFile({
    fromUrl: uri,
    toFile: path,
    headers,
    connectionTimeout: 15000,
    readTimeout: 30000,
    cacheable: true,
  }).promise;
  if (result.statusCode < 200 || result.statusCode >= 300) {
    await unlink(path).catch(() => undefined);
    throw new Error(`图片下载失败: HTTP ${result.statusCode}`);
  }
  return `file://${path}`;
}
export async function saveMangaImage(
  bookId: string,
  uri: string,
  index: number,
  headers: Record<string, string> = {},
) {
  const cached = await cacheMangaImage(bookId, uri, headers),
    source = decodeURIComponent(cached.replace(/^file:\/\//, '')),
    directory = `${DocumentDirectoryPath}/LegadoManga`,
    suffix = extension(uri),
    path = `${directory}/${stableCacheKey(bookId)}-${String(index + 1).padStart(4, '0')}.${suffix}`;
  await mkdir(directory);
  await copyFile(source, path);
  return path;
}
export async function mangaCacheStats(bookId: string) {
  const directory = `${ROOT}/${stableCacheKey(bookId)}`;
  if (!(await exists(directory))) return { files: 0, bytes: 0 };
  const files = await readDir(directory);
  return {
    files: files.filter(item => item.isFile()).length,
    bytes: files.reduce(
      (sum, item) => sum + (item.isFile() ? Number(item.size) || 0 : 0),
      0,
    ),
  };
}
export async function clearMangaCache(bookId: string) {
  const directory = `${ROOT}/${stableCacheKey(bookId)}`;
  if (await exists(directory)) await unlink(directory);
}
export async function pruneMangaCache(bookId: string, retainedUris: string[]) {
  const directory = `${ROOT}/${stableCacheKey(bookId)}`;
  if (!(await exists(directory))) return { removed: 0, retained: 0 };
  const retainedNames = new Set(
    retainedUris.map(uri => `${stableCacheKey(uri)}.${extension(uri)}`),
  );
  const files = await readDir(directory);
  let removed = 0,
    retained = 0;
  for (const file of files) {
    if (!file.isFile()) continue;
    if (retainedNames.has(file.name)) retained += 1;
    else {
      await unlink(file.path);
      removed += 1;
    }
  }
  return { removed, retained };
}
export async function cacheMangaBatch(
  bookId: string,
  images: string[],
  headers: Record<string, string> = {},
  options: {
    concurrency?: number;
    cancelled?: () => boolean;
    onProgress?: (completed: number, total: number, failed: number) => void;
  } = {},
) {
  let cursor = 0,
    completed = 0,
    failed = 0;
  const unique = [...new Set(images)],
    worker = async () => {
      while (cursor < unique.length && !options.cancelled?.()) {
        const index = cursor++;
        try {
          await cacheMangaImage(bookId, unique[index], headers);
        } catch {
          failed += 1;
        }
        completed += 1;
        options.onProgress?.(completed, unique.length, failed);
      }
    };
  await Promise.all(
    Array.from(
      {
        length: Math.min(Math.max(1, options.concurrency ?? 3), unique.length),
      },
      worker,
    ),
  );
  return {
    completed,
    total: unique.length,
    failed,
    cancelled: options.cancelled?.() === true,
  };
}
