import {
  CachesDirectoryPath,
  copyFile,
  unlink,
} from '@dr.pogodin/react-native-fs';
import { keepLocalCopy } from '@react-native-documents/picker';

/** Stage a readable archive without moving or deleting its original file. */
export async function stageBookFile(
  uri: string,
  fileName: string,
): Promise<string> {
  if (uri.startsWith('file://')) {
    const source = decodeURIComponent(uri.slice('file://'.length));
    const target = `${CachesDirectoryPath}/legado-import-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      await copyFile(source, target);
      return target;
    } catch (error) {
      try {
        await unlink(target);
      } catch {}
      throw error;
    }
  }
  const [copy] = await keepLocalCopy({
    files: [{ uri, fileName }],
    destination: 'cachesDirectory',
  });
  if (!copy || copy.status === 'error')
    throw new Error(copy?.copyError ?? 'Unable to stage book file');
  return decodeURIComponent(copy.localUri.replace(/^file:\/\//, ''));
}
