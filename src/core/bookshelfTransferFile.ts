import { keepLocalCopy, pick, saveDocuments, types } from '@react-native-documents/picker';
import { TemporaryDirectoryPath, readFile, unlink, writeFile } from '@dr.pogodin/react-native-fs';
import type { Book } from '../types';
import { exportBookshelfJson, parseBookshelfJson } from './bookshelfTransfer';

const clean = (uri: string) => uri.startsWith('file://') ? decodeURIComponent(uri.slice(7)) : uri;

export async function pickBookshelfJson() {
  const files = await pick({ type: [types.json, types.plainText], allowMultiSelection: false, mode: 'import' }),
    file = files[0],
    copies = await keepLocalCopy({ files: [{ uri: file.uri, fileName: file.name ?? 'bookshelf.json' }], destination: 'cachesDirectory' }),
    copy = copies[0];
  if (copy.status === 'error') throw new Error(copy.copyError);
  const path = clean(copy.localUri);
  try { return parseBookshelfJson(await readFile(path, 'utf8')); }
  finally { await unlink(path).catch(() => undefined); }
}

export async function saveBookshelfJson(books: Book[]) {
  const path = `${TemporaryDirectoryPath}/bookshelf-${Date.now()}.json`;
  await writeFile(path, exportBookshelfJson(books), 'utf8');
  try {
    const result = await saveDocuments({ sourceUris: [`file://${path}`], mimeType: 'application/json', fileName: 'bookshelf.json', copy: true });
    if (result[0].error) throw new Error(result[0].error);
    return result[0];
  } finally { await unlink(path).catch(() => undefined); }
}
