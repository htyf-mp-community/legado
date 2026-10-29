import { Image } from 'react-native';
import { fetch as fetchNetworkInfo } from '@react-native-community/netinfo';
import {
  CachesDirectoryPath,
  DocumentDirectoryPath,
  copyFile,
  downloadFile,
  exists,
  hash,
  mkdir,
  moveFile,
  stat,
  stopDownload,
  unlink,
} from '@dr.pogodin/react-native-fs';
import {
  getLibrarySnapshot,
  loadLibrary,
  updateLibrary,
} from '../data/library';
import { loadSources } from '../data/sources';
import { loadCoverPreferences } from '../data/coverPreferences';
import { addAppLog } from '../data/appLog';
import {
  coverImageUri,
  coverSnapshotMatches,
  networkBookCover,
} from '../core/bookCover';
import { buildBookCoverRequest } from '../core/bookCoverRequest';
export type CoverOperation = 'persist' | 'network' | 'source';
export type CoverOperationResult = {
  saved: number;
  skipped: number;
  failed: number;
};
const root = `${DocumentDirectoryPath}/covers`;
const token = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
function check(signal: AbortSignal) {
  if (signal.aborted) {
    const error = new Error('Cover operation cancelled');
    error.name = 'AbortError';
    throw error;
  }
}
async function removeTemporary(path: string) {
  if (await exists(path)) await unlink(path);
}
export async function installPersistentCover(path: string) {
  const info = await stat(path);
  if (!info.isFile() || Number(info.size) <= 0)
    throw new Error('Cover download is empty');
  await mkdir(root);
  const digest = await hash(path, 'md5'),
    target = `${root}/${digest}.cover`;
  if (await exists(target)) {
    if ((await stat(target)).isFile()) return target;
    throw new Error('Persistent cover path is not a file');
  }
  const pending = `${root}/.${digest}-${token()}.part`;
  try {
    await copyFile(path, pending);
    try {
      await moveFile(pending, target);
    } catch (cause) {
      if (!(await exists(target)) || !(await stat(target)).isFile())
        throw cause;
    }
    return target;
  } finally {
    await removeTemporary(pending);
  }
}
async function downloadCover(
  uri: string,
  headers: Record<string, string>,
  signal: AbortSignal,
) {
  check(signal);
  const directory = `${CachesDirectoryPath}/legado-cover-downloads`,
    path = `${directory}/${token()}.part`;
  await mkdir(directory);
  check(signal);
  const job = downloadFile({
      fromUrl: uri,
      toFile: path,
      headers,
      connectionTimeout: 15000,
      readTimeout: 30000,
      cacheable: true,
    }),
    cancel = () => stopDownload(job.jobId);
  signal.addEventListener('abort', cancel);
  try {
    if (signal.aborted) cancel();
    const response = await job.promise;
    check(signal);
    if (response.statusCode < 200 || response.statusCode >= 300)
      throw new Error(`HTTP ${response.statusCode}`);
    // Decode the real downloaded bytes before installing or changing a book.
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (cause?: unknown) => {
          if (settled) return;
          settled = true;
          signal.removeEventListener('abort', abortDecode);
          if (cause) reject(cause);
          else resolve();
        },
        abortDecode = () => {
          try {
            check(signal);
          } catch (cause) {
            finish(cause);
          }
        };
      signal.addEventListener('abort', abortDecode);
      if (signal.aborted) return abortDecode();
      Image.getSize(
        coverImageUri(path),
        (width, height) =>
          finish(
            width > 0 && height > 0
              ? undefined
              : new Error('Invalid cover image'),
          ),
        finish,
      );
    });
    check(signal);
    return await installPersistentCover(path);
  } finally {
    signal.removeEventListener('abort', cancel);
    await removeTemporary(path);
  }
}
let active: AbortController | undefined;
let queue: Promise<unknown> = Promise.resolve();
/** Starting any cover operation cancels its predecessor; serialized file work cannot race a restore. */
export function startManagedCoverOperation(
  kind: CoverOperation,
  ids: ReadonlySet<string>,
  onProgress: (current: number, total: number) => void = () => undefined,
) {
  active?.abort();
  const snapshot = getLibrarySnapshot();
  const controller = new AbortController(),
    signal = controller.signal,
    selected = [...ids].map(id => {
      const book = snapshot.books.find(value => value.id === id);
      return { id, exists: !!book, bookUrl: book?.bookUrl };
    });
  active = controller;
  const promise = queue
    .catch(() => undefined)
    .then(async () => {
      if (snapshot.error) throw snapshot.error;
      const result: CoverOperationResult = { saved: 0, skipped: 0, failed: 0 };
      for (let index = 0; index < selected.length; index++) {
        check(signal);
        const book = (await loadLibrary()).find(
          value =>
            selected[index].exists &&
            value.id === selected[index].id &&
            value.bookUrl === selected[index].bookUrl,
        );
        check(signal);
        if (!book) {
          result.skipped++;
          continue;
        }
        if (kind !== 'persist') {
          const eligible =
            kind === 'network'
              ? book.persistedCoverUrl !== undefined &&
                book.persistedCoverUrl !== null
              : !!(book.customCoverUrl || book.persistedCoverUrl);
          if (!eligible) {
            result.skipped++;
            continue;
          }
          await updateLibrary(current =>
            current.map(value => {
              if (
                value.id !== book.id ||
                value.bookUrl !== book.bookUrl ||
                (value.persistedCoverUrl ?? null) !==
                  (book.persistedCoverUrl ?? null) ||
                (kind === 'source' &&
                  (value.customCoverUrl ?? null) !==
                    (book.customCoverUrl ?? null))
              )
                return value;
              result.saved++;
              return {
                ...value,
                persistedCoverUrl: undefined,
                ...(kind === 'source' ? { customCoverUrl: undefined } : {}),
              };
            }),
          );
          continue;
        }
        onProgress(index + 1, selected.length);
        const uri = networkBookCover(book);
        if (!uri) {
          result.skipped++;
          continue;
        }
        try {
          if (
            loadCoverPreferences().loadOnlyWifi &&
            (await fetchNetworkInfo()).type !== 'wifi'
          )
            throw new Error('只在wifi加载图片');
          check(signal);
          const request = buildBookCoverRequest(
              uri,
              book,
              await loadSources(),
              false,
            ),
            path = await downloadCover(request.uri, request.headers, signal);
          check(signal);
          let saved = false;
          await updateLibrary(current =>
            current.map(value => {
              if (!coverSnapshotMatches(value, book)) return value;
              saved = true;
              return { ...value, persistedCoverUrl: path };
            }),
          );
          if (saved) result.saved++;
          else result.skipped++;
        } catch (cause) {
          check(signal);
          result.failed++;
          addAppLog(`保存封面失败: ${book.name}`, cause);
        }
      }
      check(signal);
      return result;
    });
  queue = promise;
  void promise
    .finally(() => {
      if (active === controller) active = undefined;
    })
    .catch(() => undefined);
  return { promise, cancel: () => controller.abort() };
}
