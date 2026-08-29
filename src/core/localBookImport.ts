import { readFile } from '@dr.pogodin/react-native-fs';
import { keepLocalCopy } from '@react-native-documents/picker';
import { importEpubBook } from './epubBook';
import { importMobiBook } from './mobiBook';
import { createTxtBook } from './txtBook';
import type { Book, TxtTocRule } from '../types';
import { decodeTxtBase64 } from './txtEncoding';

export const SUPPORTED_BOOK_FILE = /\.(?:txt|epub|mobi|prc|azw)$/i;

export async function importSupportedBook(
  uri: string,
  fileName: string,
  rules: TxtTocRule[],
  charset = 'UTF-8',
): Promise<Book> {
  if (!SUPPORTED_BOOK_FILE.test(fileName))
    throw new Error('Unsupported ebook format');
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.epub')) return importEpubBook(uri, fileName);
  if (/\.(?:mobi|prc|azw)$/.test(lower)) return importMobiBook(uri, fileName);
  const retained = /\/legado-txt-/i.test(uri) ? uri : '';
  let localUri = retained;
  if (!localUri) {
    const [copy] = await keepLocalCopy({
      files: [{ uri, fileName: `legado-txt-${Date.now()}-${fileName}` }],
      destination: 'documentDirectory',
    });
    if (!copy || copy.status === 'error')
      throw new Error(copy?.copyError ?? 'Unable to retain TXT file');
    localUri = copy.localUri;
  }
  const path = localUri.startsWith('file://')
    ? decodeURIComponent(localUri.slice(7))
    : localUri;
  const book = createTxtBook(
    uri,
    fileName,
    decodeTxtBase64(await readFile(path, 'base64'), charset),
    rules,
  );
  return { ...book, localUri, origin: 'local', originName: fileName, charset };
}
