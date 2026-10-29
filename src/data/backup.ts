import type { MMKV } from 'react-native-mmkv';
import {
  APP_STORAGE_ID,
  ENCRYPTED_BACKUP_KEY_PREFIXES,
  SENSITIVE_STORAGE_KEYS,
  appStorage,
} from './storage';
import { loadLocalPassword } from './localPassword';
import { prepareRestoreEntries } from '../core/restoreBackupEntries';
import { loadRestoreIgnore, type RestoreIgnore } from './restorePreferences';
import {
  decryptSensitiveBackup,
  encryptSensitiveBackup,
  SENSITIVE_BACKUP_ALGORITHM,
} from '../core/backupSensitive';
import {
  loadBackupPreferences,
  shouldIncludeBackupKey,
} from './backupPreferences';
import {
  mapBackupMedia,
  validateBackupMedia,
  type BackupMediaIndex,
} from '../core/backupMediaPaths';

const FORMAT = 'legado-htyf-backup';
const VERSION = 1;

export type BackupValue =
  | { type: 'string'; value: string }
  | { type: 'number'; value: number }
  | { type: 'boolean'; value: boolean };

export type BackupPayload = {
  format: typeof FORMAT;
  version: typeof VERSION;
  createdAt: number;
  storageId: typeof APP_STORAGE_ID;
  entries: Record<string, BackupValue>;
  media?: BackupMediaIndex;
  encryptedEntries?: {
    algorithm: typeof SENSITIVE_BACKUP_ALGORITHM;
    value: string;
  };
};

type BackupStorage = Pick<
  MMKV,
  'getAllKeys' | 'getString' | 'getNumber' | 'getBoolean' | 'set' | 'clearAll'
>;

function readEntries(
  storage: BackupStorage,
  filter: (key: string) => boolean = () => true,
): Record<string, BackupValue> {
  const entries: Record<string, BackupValue> = {};
  for (const key of storage.getAllKeys()) {
    if (!filter(key)) continue;
    const stringValue = storage.getString(key);
    if (stringValue !== undefined) {
      entries[key] = { type: 'string', value: stringValue };
      continue;
    }
    const numberValue = storage.getNumber(key);
    if (numberValue !== undefined) {
      entries[key] = { type: 'number', value: numberValue };
      continue;
    }
    const booleanValue = storage.getBoolean(key);
    if (booleanValue !== undefined)
      entries[key] = { type: 'boolean', value: booleanValue };
  }
  return entries;
}

function writeEntries(
  storage: BackupStorage,
  entries: Record<string, BackupValue>,
) {
  for (const [key, entry] of Object.entries(entries))
    storage.set(key, entry.value);
}

function validateEntries(entries: Record<string, BackupValue>) {
  for (const [key, entry] of Object.entries(entries)) {
    if (!key || !entry || typeof entry !== 'object')
      throw new Error('备份条目无效');
    const valid =
      (entry.type === 'string' && typeof entry.value === 'string') ||
      (entry.type === 'number' && Number.isFinite(entry.value)) ||
      (entry.type === 'boolean' && typeof entry.value === 'boolean');
    if (!valid) throw new Error(`备份条目 ${key} 的类型无效`);
  }
}

export function createBackup(
  storage: BackupStorage = appStorage,
  password = loadLocalPassword(),
): string {
  const preferences = loadBackupPreferences();
  const encrypted = readEntries(
    storage,
    key =>
      ENCRYPTED_BACKUP_KEY_PREFIXES.some(prefix => key.startsWith(prefix)) &&
      shouldIncludeBackupKey(key, preferences),
  );
  const payload: BackupPayload = {
    format: FORMAT,
    version: VERSION,
    createdAt: Date.now(),
    storageId: APP_STORAGE_ID,
    entries: readEntries(
      storage,
      key =>
        !SENSITIVE_STORAGE_KEYS.has(key) &&
        !ENCRYPTED_BACKUP_KEY_PREFIXES.some(prefix => key.startsWith(prefix)) &&
        shouldIncludeBackupKey(key, preferences),
    ),
    ...(Object.keys(encrypted).length
      ? {
          encryptedEntries: {
            algorithm: SENSITIVE_BACKUP_ALGORITHM,
            value: encryptSensitiveBackup(JSON.stringify(encrypted), password),
          },
        }
      : {}),
  };
  return JSON.stringify(
    preferences.categories.persistedCovers
      ? payload
      : mapBackupMedia(payload, value => value, false),
  );
}

export function parseBackup(input: string): BackupPayload {
  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch {
    throw new Error('备份内容不是有效的 JSON');
  }
  if (!value || typeof value !== 'object') throw new Error('备份格式无效');
  const candidate = value as Partial<BackupPayload>;
  if (candidate.format !== FORMAT || candidate.version !== VERSION)
    throw new Error('不支持的备份格式或版本');
  if (candidate.storageId !== APP_STORAGE_ID)
    throw new Error('备份不属于当前应用的存储空间');
  if (!Number.isFinite(candidate.createdAt)) throw new Error('备份时间无效');
  if (!candidate.entries || typeof candidate.entries !== 'object')
    throw new Error('备份数据无效');
  validateEntries(candidate.entries as Record<string, BackupValue>);
  if (candidate.media !== undefined) validateBackupMedia(candidate.media);
  if (candidate.encryptedEntries !== undefined) {
    if (
      !candidate.encryptedEntries ||
      candidate.encryptedEntries.algorithm !== SENSITIVE_BACKUP_ALGORITHM ||
      typeof candidate.encryptedEntries.value !== 'string' ||
      !candidate.encryptedEntries.value
    )
      throw new Error('敏感备份数据格式无效');
  }
  return candidate as BackupPayload;
}

export function restoreBackup(
  input: string,
  storage: BackupStorage = appStorage,
  password = loadLocalPassword(),
  ignore: Partial<RestoreIgnore> = loadRestoreIgnore(),
): BackupPayload {
  const payload = parseBackup(input);
  let encryptedEntries: Record<string, BackupValue> = {};
  if (payload.encryptedEntries && !ignore.ignoreCookies) {
    let decoded: unknown;
    try {
      decoded = JSON.parse(
        decryptSensitiveBackup(payload.encryptedEntries.value, password),
      );
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded))
      throw new Error('敏感备份数据无效');
    encryptedEntries = decoded as Record<string, BackupValue>;
    validateEntries(encryptedEntries);
    for (const key of Object.keys(encryptedEntries))
      if (!ENCRYPTED_BACKUP_KEY_PREFIXES.some(prefix => key.startsWith(prefix)))
        throw new Error('敏感备份包含不允许的条目');
  }
  const previous = readEntries(storage);
  const incoming = Object.fromEntries(
    Object.entries({ ...payload.entries, ...encryptedEntries }).filter(
      ([key]) => !SENSITIVE_STORAGE_KEYS.has(key),
    ),
  );
  const changes = prepareRestoreEntries(previous, incoming, ignore);
  try {
    writeEntries(storage, changes);
  } catch (error) {
    storage.clearAll();
    writeEntries(storage, previous);
    throw error;
  }
  return payload;
}
