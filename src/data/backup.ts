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
import {
  readStorageEntries,
  writeStorageEntries,
  validateStorageEntryType,
  STORAGE_VALUE_TYPES_KEY,
  type StorageEntry,
} from './storageValues';

const FORMAT = 'legado-htyf-backup';
const VERSION = 1;

export type BackupValue = StorageEntry;

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

/** Typed storage seam for backup restore; callers must provide the application's isolated namespace. */
export type BackupStorage = Pick<
  MMKV,
  'getAllKeys' | 'getString' | 'getNumber' | 'getBoolean' | 'set' | 'clearAll'
>;

/**
 * Commit one prepared restore unit, rolling back only this unit if a storage write throws.
 * Snapshot logical types and the exact private type index. Native restore invokes this per
 * source transaction; an earlier successful unit is therefore retained on a later failure.
 */
export function commitRestoreEntries(
  changes: Record<string, BackupValue>,
  storage: BackupStorage = appStorage,
) {
  if (!Object.keys(changes).length) return;
  const previous = readStorageEntries(storage);
  const previousTypeIndex = storage.getString(STORAGE_VALUE_TYPES_KEY);
  try {
    writeStorageEntries(storage, changes);
  } catch (error) {
    storage.clearAll();
    for (const [key, entry] of Object.entries(previous))
      storage.set(key, entry.value);
    if (previousTypeIndex !== undefined)
      storage.set(STORAGE_VALUE_TYPES_KEY, previousTypeIndex);
    throw error;
  }
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
    validateStorageEntryType(key);
  }
}

export function createBackup(
  storage: BackupStorage = appStorage,
  password = loadLocalPassword(),
): string {
  const preferences = loadBackupPreferences();
  const encrypted = readStorageEntries(
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
    entries: readStorageEntries(
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
  const previous = readStorageEntries(storage);
  const incoming = Object.fromEntries(
    Object.entries({ ...payload.entries, ...encryptedEntries }).filter(
      ([key]) => !SENSITIVE_STORAGE_KEYS.has(key),
    ),
  );
  // The host exposes no Android ID. A private, per-install restore identity keeps other
  // devices' counters separate without exporting or overwriting device identity.
  const recordDeviceKey = 'reading.record-device.v1';
  const previousRecordDevice = storage.getString(recordDeviceKey);
  const ownRecordDevice =
    previousRecordDevice ||
    `htyf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const changes = prepareRestoreEntries(
    previous,
    incoming,
    ignore,
    ownRecordDevice,
  );
  const recordEntry = incoming['reading.records.v1'];
  const hasReadRecordRows =
    recordEntry?.type === 'string' &&
    (JSON.parse(recordEntry.value) as unknown[]).length > 0;
  commitRestoreEntries(
    {
      ...(hasReadRecordRows && !previousRecordDevice
        ? {
            [recordDeviceKey]: {
              type: 'string' as const,
              value: ownRecordDevice,
            },
          }
        : {}),
      ...changes,
    },
    storage,
  );
  return payload;
}
