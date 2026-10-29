import { appStorage } from './storage';
export const BATCH_SOURCE_DELAY_KEY = 'book-source.batch-delay-seconds.v1';
export const normalizeBatchSourceDelay = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(9999, Math.trunc(value))) : 0;
export const loadBatchSourceDelay = () =>
  normalizeBatchSourceDelay(appStorage.getNumber(BATCH_SOURCE_DELAY_KEY) ?? 0);
export function saveBatchSourceDelay(value: number) {
  const normalized = normalizeBatchSourceDelay(value);
  appStorage.set(BATCH_SOURCE_DELAY_KEY, normalized);
  return normalized;
}
