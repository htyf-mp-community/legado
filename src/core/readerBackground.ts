import { keepLocalCopy, pick } from '@react-native-documents/picker';

export async function pickReaderBackground() {
  const selected = await pick({ type: ['image/*'], allowMultiSelection: false, mode: 'import' });
  const file = selected[0];
  if (!file) throw new Error('没有选择背景图片');
  const copies = await keepLocalCopy({
    destination: 'documentDirectory',
    files: [{ uri: file.uri, fileName: `${Date.now()}-${file.name ?? 'reader-background'}` }],
  });
  const copy = copies[0];
  if (!copy || copy.status === 'error') throw new Error(copy?.copyError ?? '无法保存背景图片');
  return copy.localUri;
}
