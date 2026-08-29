import { Share } from 'react-native';
import { saveDocuments } from '@react-native-documents/picker';
import {
  TemporaryDirectoryPath,
  unlink,
  writeFile,
} from '@dr.pogodin/react-native-fs';

const safeFileName = (value: string) => {
  const name = value.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_');
  if (!name) throw new Error('JSON file name is empty');
  return name.toLowerCase().endsWith('.json') ? name : `${name}.json`;
};

export async function saveJsonDocument(content: string, fileName: string) {
  const safe = safeFileName(fileName),
    path = `${TemporaryDirectoryPath}/${Date.now()}-${safe}`;
  await writeFile(path, content, 'utf8');
  try {
    const result = await saveDocuments({
        sourceUris: [`file://${path}`],
        mimeType: 'application/json',
        fileName: safe,
        copy: true,
      }),
      saved = result[0];
    if (!saved) throw new Error('Document export returned no result');
    if (saved.error) throw new Error(saved.error);
    return saved;
  } finally {
    await unlink(path).catch(() => undefined);
  }
}

export function shareJsonText(content: string, title: string) {
  return Share.share({ message: content, title });
}
