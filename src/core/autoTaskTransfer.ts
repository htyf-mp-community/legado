import { keepLocalCopy, pick, types } from '@react-native-documents/picker';
import { readFile, unlink } from '@dr.pogodin/react-native-fs';
import {
  exportAutoTasks,
  parseAutoTasks,
  type AutoTaskRule,
} from '../data/autoTasks';
import { saveJsonDocument } from './jsonTransfer';

const clean = (uri: string) =>
  uri.startsWith('file://') ? decodeURIComponent(uri.slice(7)) : uri;
export async function pickAutoTaskJson() {
  const files = await pick({
    type: [types.json, types.plainText],
    allowMultiSelection: false,
    mode: 'import',
  });
  const file = files[0],
    copies = await keepLocalCopy({
      files: [{ uri: file.uri, fileName: file.name ?? 'auto-tasks.json' }],
      destination: 'cachesDirectory',
    }),
    copy = copies[0];
  if (copy.status === 'error') throw new Error(copy.copyError);
  try {
    return parseAutoTasks(await readFile(clean(copy.localUri), 'utf8'));
  } finally {
    await unlink(clean(copy.localUri)).catch(() => undefined);
  }
}
export async function fetchAutoTaskJson(
  url: string,
  fetcher: typeof fetch = fetch,
) {
  if (!/^https?:\/\//i.test(url.trim()))
    throw new Error('Auto-task import URL must use HTTP or HTTPS');
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 20_000);
  const response = await fetcher(url.trim(), {
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
  const body = await response.text();
  if (!response.ok)
    throw new Error(`HTTP ${response.status}: ${body.slice(0, 300)}`);
  return parseAutoTasks(body);
}
export async function saveAutoTaskJson(tasks: AutoTaskRule[]) {
  return saveJsonDocument(exportAutoTasks(tasks), 'exportAutoTask.json');
}
