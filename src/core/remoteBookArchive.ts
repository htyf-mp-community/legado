import {
  CachesDirectoryPath,
  readDir,
  unlink,
  type ReadDirResItemT,
} from '@dr.pogodin/react-native-fs';
import { getUnzip } from 'react-native-nitro-unzip';
import { importSupportedBook, SUPPORTED_BOOK_FILE } from './localBookImport';
import type { Book, TxtTocRule } from '../types';

const MAX_ARCHIVE_FILES = 2000,
  MAX_ARCHIVE_BYTES = 1024 * 1024 * 1024,
  MAX_DEPTH = 16;

export async function collectArchiveBookFiles(
  root: string,
  reader: (path: string) => Promise<ReadDirResItemT[]> = readDir,
) {
  const files: Array<{ path: string; name: string; relative: string }> = [],
    queue = [{ path: root, relative: '', depth: 0 }];
  let bytes = 0,
    seen = 0;
  while (queue.length) {
    const current = queue.shift()!;
    if (current.depth > MAX_DEPTH)
      throw new Error('Archive directory nesting is too deep');
    for (const item of await reader(current.path)) {
      seen += 1;
      if (seen > MAX_ARCHIVE_FILES)
        throw new Error('Archive contains too many files');
      const relative = current.relative
        ? `${current.relative}/${item.name}`
        : item.name;
      if (item.isDirectory())
        queue.push({ path: item.path, relative, depth: current.depth + 1 });
      else {
        bytes += Number(item.size) || 0;
        if (bytes > MAX_ARCHIVE_BYTES)
          throw new Error('Archive expands beyond the safety limit');
        if (SUPPORTED_BOOK_FILE.test(item.name))
          files.push({ path: item.path, name: item.name, relative });
      }
    }
  }
  return files;
}

export async function importRemoteZip(
  zipPath: string,
  remoteUrl: string,
  rules: TxtTocRule[],
) {
  const directory = `${CachesDirectoryPath}/remote-archive-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    const result = await getUnzip().extract(zipPath, directory).await();
    if (!result.success) throw new Error('Unable to extract ZIP archive');
    const files = await collectArchiveBookFiles(directory);
    if (!files.length)
      throw new Error('ZIP archive contains no supported ebooks');
    const books: Book[] = [];
    for (const file of files) {
      const book = await importSupportedBook(
        `file://${file.path}`,
        file.name,
        rules,
      );
      books.push({
        ...book,
        id: `remote:${encodeURIComponent(`${remoteUrl}#${file.relative}`)}`,
        origin: 'webdav',
        originName: file.relative,
        bookUrl: `${remoteUrl}#${encodeURIComponent(file.relative)}`,
        updatedAt: Date.now(),
      });
    }
    return books;
  } finally {
    try {
      await unlink(directory);
    } catch {}
  }
}
