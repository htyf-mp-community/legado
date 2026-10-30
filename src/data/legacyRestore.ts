import {
  commitRestoreEntries,
  parseBackup,
  type BackupPayload,
  type BackupStorage,
  type BackupValue,
} from './backup';
import { appStorage, SENSITIVE_STORAGE_KEYS } from './storage';
import { readStorageEntries } from './storageValues';
import { loadRestoreIgnore, type RestoreIgnore } from './restorePreferences';
import {
  prepareRestoreEntries,
  restoreBookIdentities,
} from '../core/restoreBackupEntries';
import { parseLegacyJson } from '../core/legacyJson';
import {
  normalizeReadRecord,
  coalesceReadRecordRows,
  readRecordLong,
  type ReadRecord,
} from '../core/readRecord';
import { readRecordAuthorIsBlank } from '../core/readRecordAuthors';

const RECORDS = 'reading.records.v1';
const DEVICE = 'reading.record-device.v1';
// Restore.kt mutates these tables before its per-record loop. autoTask.json is prefetched
// before books, but its actual upsert occurs only after preferences and media succeed.
const BEFORE_RECORDS = [
  'library.v1',
  'annotations.bookmarks.v1',
  'annotations.highlights.v1',
  'highlight.rules.v1',
  'bookshelf.groups.v1',
  'sources.v1',
  'rss.sources.v1',
  'rss.articles.v1',
  'replace.rules.v1',
  'rule.subscriptions.v1',
  'txt.toc.rules.v1',
  'http.tts.engines.v1',
  'dictionary.rules.v1',
  'keyboard-assists.v1',
];
const AFTER_RECORDS = ['legacy.servers.v1'];
const AFTER_COOKIES = [
  'legacy.runtime-source-cache.v1',
  'reader.preferences.v1',
  'legacy.read-config.v1',
];
const NON_FATAL = new Set([
  'annotations.highlights.v1',
  'highlight.rules.v1',
  'legacy.servers.v1',
  'reader.preferences.v1',
  'legacy.read-config.v1',
]);

/** A source runCatching category failure is logged and later categories still run. */
export type LegacyRestoreWarning = { key: string; error: unknown };
/** A native restore outcome includes the successful units, even when a later unit fails. */
export type LegacyRestoreResult = {
  payload: BackupPayload;
  committedKeys: string[];
  warnings: LegacyRestoreWarning[];
};
let nativeRestoreTail: Promise<void> = Promise.resolve();

/** Native failure retains earlier committed units; callers must refresh visible data and avoid promising rollback. */
export class LegacyRestoreError extends Error {
  readonly committedKeys: string[];
  readonly warnings: LegacyRestoreWarning[];
  constructor(
    error: unknown,
    committedKeys: string[],
    warnings: LegacyRestoreWarning[],
  ) {
    super(error instanceof Error ? error.message : String(error));
    this.name = 'LegacyRestoreError';
    this.committedKeys = [...committedKeys];
    this.warnings = [...warnings];
  }
}

/**
 * Restore an already-decoded native ZIP payload in the source's mutation order.
 * Each record is its own source DAO transaction: an invalid later record retains its
 * committed prefix and stops all later categories. Only a failing storage unit rolls back.
 * `restoreMedia` runs after configuration and before auto tasks, as in Restore.kt.
 * Calls are serialized like Restore.restoreLocked, including asynchronous media activation.
 * This entry point is selected by native archive inspection, never by fields in an HTYF JSON.
 * Invalid converted payloads fail before writing; later failures carry committedKeys in
 * LegacyRestoreError. Callers must refresh visible state when that list is nonempty.
 * Current native file converters and media-copy limitations remain documented in the gaps report.
 */
export function restoreLegacyBackup(
  input: string,
  storage: BackupStorage = appStorage,
  ignore?: Partial<RestoreIgnore>,
  restoreMedia?: () => Promise<void>,
): Promise<LegacyRestoreResult> {
  const run = () =>
    applyLegacyBackup(
      input,
      storage,
      ignore ?? loadRestoreIgnore(),
      restoreMedia,
    );
  const result = nativeRestoreTail.then(run);
  nativeRestoreTail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function applyLegacyBackup(
  input: string,
  storage: BackupStorage,
  ignore: Partial<RestoreIgnore>,
  restoreMedia?: () => Promise<void>,
): Promise<LegacyRestoreResult> {
  const payload = parseBackup(input);
  if (payload.encryptedEntries)
    throw new Error('旧版恢复只接受已解密的原版条目');
  const incoming = Object.fromEntries(
    Object.entries(payload.entries).filter(
      ([key]) => !SENSITIVE_STORAGE_KEYS.has(key),
    ),
  );
  const known = new Set([
    ...BEFORE_RECORDS,
    RECORDS,
    ...AFTER_RECORDS,
    ...AFTER_COOKIES,
    'auto.tasks.v1',
  ]);
  for (const key of Object.keys(incoming))
    if (!known.has(key) && !key.startsWith('source-cookie.v1.'))
      throw new Error('旧版备份包含尚未支持的数据');
  let current = readStorageEntries(storage);
  const bookIds = restoreBookIdentities(current, incoming);
  const ownDevice =
    storage.getString(DEVICE) ||
    `htyf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const committedKeys: string[] = [],
    warnings: LegacyRestoreWarning[] = [];
  const commitPrepared = (
    key: string,
    changes: Record<string, BackupValue>,
  ) => {
    if (!Object.keys(changes).length) return;
    if (key === RECORDS && !storage.getString(DEVICE))
      changes[DEVICE] = { type: 'string', value: ownDevice };
    commitRestoreEntries(changes, storage);
    current = readStorageEntries(storage);
    committedKeys.push(key);
  };
  const commit = (key: string, value: BackupValue) =>
    commitPrepared(
      key,
      prepareRestoreEntries(
        current,
        { [key]: value },
        ignore,
        ownDevice,
        bookIds,
      ),
    );
  const category = (key: string) => {
    const value = incoming[key];
    if (!value) return;
    try {
      commit(key, value);
    } catch (error) {
      if (!NON_FATAL.has(key)) throw error;
      warnings.push({ key, error });
    }
  };
  try {
    for (const key of BEFORE_RECORDS) category(key);
    const entry = incoming[RECORDS];
    if (entry) {
      if (entry.type !== 'string') throw new Error('旧版阅读记录应为对象数组');
      const records = parseLegacyJson(entry.value);
      if (!Array.isArray(records)) throw new Error('旧版阅读记录应为对象数组');
      for (const row of records) {
        const value = { type: 'string' as const, value: JSON.stringify([row]) };
        // Validate null Strings before testing the source own-counter/no-insert branch.
        const changes = prepareRestoreEntries(
          current,
          { [RECORDS]: value },
          ignore,
          ownDevice,
          bookIds,
        );
        const normalized = normalizeReadRecord(row)!;
        const previous =
          current[RECORDS]?.type === 'string'
            ? coalesceReadRecordRows(
                parseLegacyJson(current[RECORDS].value) as ReadRecord[],
              ).find(
                item =>
                  (item.deviceId ?? '') === (normalized.deviceId ?? '') &&
                  item.bookName === normalized.bookName,
              )
            : undefined;
        if (
          previous &&
          (normalized.deviceId ?? '') === ownDevice &&
          readRecordLong(previous.readTime) >=
            readRecordLong(normalized.readTime) &&
          readRecordAuthorIsBlank(normalized.author)
        )
          continue;
        commitPrepared(RECORDS, changes);
      }
    }
    for (const key of AFTER_RECORDS) category(key);
    for (const key of Object.keys(incoming))
      if (key.startsWith('source-cookie.v1.')) category(key);
    for (const key of AFTER_COOKIES) category(key);
    await restoreMedia?.();
    const tasks = incoming['auto.tasks.v1'];
    // Source upsert is conditional on !restoredAutoTasks.isNullOrEmpty().
    if (
      tasks &&
      (tasks.type !== 'string' ||
        (parseLegacyJson(tasks.value) as unknown[]).length !== 0)
    )
      category('auto.tasks.v1');
    return { payload, committedKeys, warnings };
  } catch (error) {
    throw new LegacyRestoreError(error, committedKeys, warnings);
  }
}
