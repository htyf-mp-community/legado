import {
  keepLocalCopy,
  pick,
  saveDocuments,
  types,
} from '@react-native-documents/picker';
import {
  TemporaryDirectoryPath,
  mkdir,
  readFile,
  unlink,
  writeFile,
} from '@dr.pogodin/react-native-fs';
import type { Book } from '../types';
import { exportBookList } from './bookList';
const pathOf = (uri: string) =>
  uri.startsWith('file://') ? decodeURIComponent(uri.slice(7)) : uri;
export async function pickBookListText() {
  const [file] = await pick({
    type: [types.json, types.plainText],
    allowMultiSelection: false,
    mode: 'import',
  });
  const [copy] = await keepLocalCopy({
    files: [{ uri: file.uri, fileName: file.name ?? 'books.json' }],
    destination: 'cachesDirectory',
  });
  if (copy.status === 'error') throw new Error(copy.copyError);
  const path = pathOf(copy.localUri);
  try {
    return await readFile(path, 'utf8');
  } finally {
    await unlink(path).catch(() => undefined);
  }
}
export async function saveBookList(books: Book[]) {
  // iOS derives the proposed name from sourceUris; its fileName option is Android-only.
  const directory = `${TemporaryDirectoryPath}/book-list-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    path = `${directory}/books.json`;
  await mkdir(directory);
  try {
    await writeFile(path, exportBookList(books), 'utf8');
    const [result] = await saveDocuments({
      sourceUris: [`file://${path}`],
      mimeType: 'application/json',
      fileName: 'books.json',
      copy: true,
    });
    if (result.error) throw new Error(result.error);
    return result;
  } finally {
    await unlink(directory).catch(() => undefined);
  }
}
