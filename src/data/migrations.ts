import type { MMKV } from 'react-native-mmkv';
import { appStorage } from './storage';
import { readStorageEntries, STORAGE_VALUE_TYPES_KEY } from './storageValues';

export const CURRENT_STORAGE_SCHEMA = 1;
const VERSION = 'storage.schema.version';
type Store = Pick<
  MMKV,
  'getAllKeys' | 'getString' | 'getNumber' | 'getBoolean' | 'set' | 'remove'
>;

/** 迁移旧任务键；失败时恢复完整逻辑值及类型索引，不把布尔/数字误存为字符串。 */
export function runStorageMigrations(store: Store = appStorage) {
  const from = Math.max(0, store.getNumber(VERSION) ?? 0);
  if (from >= CURRENT_STORAGE_SCHEMA) return from;
  const before = readStorageEntries(store);
  const previousTypeIndex = store.getString(STORAGE_VALUE_TYPES_KEY);
  try {
    let version = from;
    if (version < 1) {
      const legacy = store.getString('autoTaskRules');
      if (legacy && !store.getString('auto.tasks.v1'))
        store.set('auto.tasks.v1', legacy);
      store.remove('autoTaskRules');
      version = 1;
    }
    store.set(VERSION, version);
    return version;
  } catch (error) {
    for (const key of store.getAllKeys()) store.remove(key);
    for (const [key, entry] of Object.entries(before))
      store.set(key, entry.value);
    if (previousTypeIndex !== undefined)
      store.set(STORAGE_VALUE_TYPES_KEY, previousTypeIndex);
    throw error;
  }
}
