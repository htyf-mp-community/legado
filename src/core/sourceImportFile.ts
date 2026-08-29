import { keepLocalCopy, pick, types } from '@react-native-documents/picker';
import { readFile, unlink } from '@dr.pogodin/react-native-fs';
import { parseBookSources } from '../data/sources';

const cleanFileUri = (uri: string) =>
  uri.startsWith('file://') ? decodeURIComponent(uri.slice(7)) : uri;

export async function pickBookSourcesInput() {
  const files = await pick({
      type: [types.json, types.plainText, 'text/javascript'],
      allowMultiSelection: false,
      mode: 'import',
    }),
    file = files[0],
    copies = await keepLocalCopy({
      files: [{ uri: file.uri, fileName: file.name ?? 'book-sources.json' }],
      destination: 'cachesDirectory',
    }),
    copy = copies[0];
  if (copy.status === 'error') throw new Error(copy.copyError);
  const path = cleanFileUri(copy.localUri);
  try {
    return parseBookSources(await readFile(path, 'utf8'));
  } finally {
    await unlink(path).catch(() => undefined);
  }
}
