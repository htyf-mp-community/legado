import { parseLegacyJson } from './legacyJson';
import { mergeReadRecordRows, normalizeReadRecord } from './readRecord';
import { isLocalBook } from './bookKinds';
import type { BackupValue } from '../data/backup';
import type { RestoreIgnore } from '../data/restorePreferences';

type Entries = Record<string, BackupValue>;
type Row = Record<string, unknown>;
const identities: Record<string, string> = {
  'library.v1': 'id',
  'bookshelf.groups.v1': 'id',
  'annotations.bookmarks.v1': 'id',
  'annotations.highlights.v1': 'id',
  'sources.v1': 'bookSourceUrl',
  'rss.sources.v1': 'sourceUrl',
  'rss.articles.v1': 'id',
  'replace.rules.v1': 'id',
  'txt.toc.rules.v1': 'id',
  'dictionary.rules.v1': 'name',
  'rule.subscriptions.v1': 'id',
  'auto.tasks.v1': 'id',
  'http.tts.engines.v1': 'id',
  'legacy.runtime-source-cache.v1': 'key',
  'legacy.servers.v1': 'id',
};
const replaceLists = new Set([
  'keyboard-assists.v1',
  'highlight.rules.v1',
  'appearance.theme-presets.v1',
]);
const object = (value: unknown): value is Row =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));
function decode(entry: BackupValue, key: string): unknown {
  if (entry.type !== 'string') throw new Error(`备份条目 ${key} 应为 JSON`);
  try {
    return key === 'reading.records.v1'
      ? parseLegacyJson(entry.value)
      : JSON.parse(entry.value);
  } catch {
    throw new Error(`备份条目 ${key} 不是有效的 JSON`);
  }
}
function rows(entry: BackupValue, key: string): Row[] {
  const value = decode(entry, key);
  if (!Array.isArray(value) || !value.every(object))
    throw new Error(`备份条目 ${key} 应为对象数组`);
  return value;
}
const encode = (value: unknown): BackupValue => ({
  type: 'string',
  value: JSON.stringify(value),
});
const identity = (row: Row, field: string, key: string) => {
  const value = row[field];
  if (!['string', 'number'].includes(typeof value) || String(value) === '')
    throw new Error(`备份条目 ${key} 缺少标识 ${field}`);
  return String(value);
};

/** Resolve native book URLs against existing target IDs once, so later restore phases keep annotation ownership. */
export function restoreBookIdentities(
  previous: Entries,
  incoming: Entries,
): Map<string, string> {
  const bookIds = new Map<string, string>();
  const currentBooks =
    incoming['library.v1'] && previous['library.v1']
      ? rows(previous['library.v1'], 'library.v1')
      : [];
  if (incoming['library.v1'])
    for (const row of rows(incoming['library.v1'], 'library.v1')) {
      const match = currentBooks.find(
        book =>
          book.id === row.id || (row.bookUrl && book.bookUrl === row.bookUrl),
      );
      if (match)
        bookIds.set(
          identity(row, 'id', 'library.v1'),
          identity(match, 'id', 'library.v1'),
        );
    }
  return bookIds;
}

/** Compute an upsert without writing. Optional book IDs carry ownership across ordered native phases. */
export function prepareRestoreEntries(
  previous: Entries,
  incoming: Entries,
  ignore: Partial<RestoreIgnore> = {},
  ownReadRecordDeviceId?: string,
  nativeBookIds?: ReadonlyMap<string, string>,
): Entries {
  const result: Entries = {},
    bookIds = new Map([
      ...(nativeBookIds ?? []),
      ...restoreBookIdentities(previous, incoming),
    ]);
  const currentBooks =
    incoming['library.v1'] && previous['library.v1']
      ? rows(previous['library.v1'], 'library.v1')
      : [];
  for (const [key, entry] of Object.entries(incoming)) {
    if (
      key === 'backup.restore-ignore.v1' ||
      key === 'reading.record-sort.v1' ||
      key === 'reading.record-device.v1' ||
      (ignore.ignoreCookies && key.startsWith('source-cookie.')) ||
      (ignore.ignoreSourceVariables &&
        key === 'legacy.runtime-source-cache.v1') ||
      (ignore.readConfig &&
        [
          'reader.preferences.v1',
          'legacy.read-config.v1',
          'reader.menu.config.v1',
          'local-web-service.reader-config.v1',
        ].includes(key)) ||
      (ignore.coverConfig && key === 'cover.preferences.v1') ||
      (ignore.bookshelfLayout && key === 'bookshelf.layout.v1')
    )
      continue;
    if (key === 'reading.records.v1') {
      const parsed = (entryRows: Row[], incomingRows = false) =>
        entryRows.map(row => {
          // Gson preserves explicit null String fields. Native DAO/Room insertion fails;
          // do not turn unknown authors into empty strings or silently drop the row.
          if (
            incomingRows &&
            ['deviceId', 'bookName', 'author'].some(
              field => row[field] === null,
            )
          )
            throw new Error(`备份条目 ${key} 的设备、书名和作者不能为 null`);
          const normalized = normalizeReadRecord(row);
          if (!normalized) throw new Error(`备份条目 ${key} 缺少书名`);
          return normalized.bookId && bookIds.has(normalized.bookId)
            ? { ...normalized, bookId: bookIds.get(normalized.bookId) }
            : normalized;
        });
      result[key] = encode(
        mergeReadRecordRows(
          previous[key] ? parsed(rows(previous[key], key)) : [],
          parsed(rows(entry, key), true),
          ownReadRecordDeviceId,
        ),
      );
      continue;
    }
    const field = identities[key];
    if (field) {
      const current = previous[key] ? rows(previous[key], key) : [];
      const values = new Map(
        current.map(row => [identity(row, field, key), row]),
      );
      for (const source of rows(entry, key)) {
        let row = source;
        if (
          key === 'library.v1' &&
          ignore.localBook &&
          isLocalBook({
            origin: typeof row.origin === 'string' ? row.origin : undefined,
            localUri:
              typeof row.localUri === 'string' ? row.localUri : undefined,
            nativeType:
              typeof row.nativeType === 'number' ? row.nativeType : undefined,
          })
        )
          continue;
        if (key === 'library.v1') {
          const match = currentBooks.find(
            book =>
              book.id === row.id ||
              (row.bookUrl && book.bookUrl === row.bookUrl),
          );
          if (match) {
            bookIds.set(identity(row, field, key), identity(match, field, key));
            row = { ...row, id: match.id };
          }
        }
        const id = identity(row, field, key);
        values.set(id, row);
      }
      result[key] = encode([...values.values()]);
    } else if (replaceLists.has(key)) {
      result[key] = encode(rows(entry, key));
    } else if (/\.(?:preferences|config|reader-config)\.v1$/.test(key)) {
      const value = decode(entry, key),
        local = previous[key] && decode(previous[key], key);
      if (!object(value) || (local && !object(local)))
        throw new Error(`备份条目 ${key} 应为配置对象`);
      const patch = { ...value };
      if (key === 'cover.preferences.v1') {
        delete patch.defaultCover;
        delete patch.defaultCoverDark;
      }
      if (key === 'backup.preferences.v1')
        for (const name of [
          'categories',
          'deviceName',
          'autoBackup',
          'webDavBookAutoRestore',
          'lastBackup',
          'lastCheckedRemote',
        ])
          delete patch[name];
      if (key === 'app.preferences.v1') {
        if (ignore.themeMode) delete patch.themeMode;
        if (ignore.themeConfig)
          for (const name of Object.keys(patch))
            if (/^(?:day|night)/.test(name)) delete patch[name];
      }
      if (key === 'bookshelf.preferences.v1' && ignore.bookshelfLayout)
        delete patch.layout;
      if (key === 'general.preferences.v1') {
        if (ignore.showRss) delete patch.showRss;
        if (ignore.threadCount) delete patch.threadCount;
      }
      result[key] = encode({ ...(local as Row | undefined), ...patch });
    } else result[key] = entry;
  }
  for (const key of ['annotations.bookmarks.v1', 'annotations.highlights.v1']) {
    if (!result[key] || !incoming[key]) continue;
    const imported = new Set(
      rows(incoming[key], key).map(row => identity(row, identities[key], key)),
    );
    result[key] = encode(
      rows(result[key], key).map(row =>
        imported.has(identity(row, identities[key], key)) &&
        bookIds.has(String(row.bookId))
          ? { ...row, bookId: bookIds.get(String(row.bookId)) }
          : row,
      ),
    );
  }
  return result;
}
