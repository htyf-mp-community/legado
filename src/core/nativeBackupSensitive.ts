import { parseGsonLegacyJson, type GsonJsonValue } from './gsonJson';
import { trimSourceWhitespace } from './nativeSourceUrl';
import { storeReadRecordLong, type ReadRecordLong } from './readRecord';

/** Native persistent-cookie rows. Empty cookie strings are valid; blank URLs are not. */
export type NativeBackupCookie = { url: string; cookie: string };
/** Native cache expiry is a nonnegative signed Long, in milliseconds; zero has no deadline. */
export type NativeBackupRuntimeCache = {
  key: string;
  value: string | null;
  deadline: ReadRecordLong;
};
const prefixes = [
  'v_',
  'userInfo_',
  'loginHeader_',
  'sourceVariable_',
  'infoMap_',
];
const invalid = (file: string): never => {
  throw new Error(`${file} 包含无效的备份数据`);
};

function strictRows(raw: string, file: string) {
  // GsonStrict permits one initial BOM, but rejects comments, lenient separators and
  // unquoted strings. Validate grammar before retaining exact number/duplicate tokens.
  try {
    JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
    const tree = parseGsonLegacyJson(raw);
    if (tree.kind !== 'array') return invalid(file);
    return tree.values.map(value =>
      value.kind === 'object' ? value.values : invalid(file),
    );
  } catch {
    return invalid(file);
  }
}
const stringField = (value: GsonJsonValue | undefined, file: string) =>
  value?.kind === 'string' ? value.value : invalid(file);

/** Strict Restore.parseCookieBackup contract; rejects the whole file before any data commit. */
export function parseNativeCookieBackup(raw: string): NativeBackupCookie[] {
  return strictRows(raw, 'cookies.json').map(row => {
    const url = stringField(row.get('url'), 'cookies.json');
    const cookie = stringField(row.get('cookie'), 'cookies.json');
    if (!trimSourceWhitespace(url)) return invalid('cookies.json');
    return { url, cookie };
  });
}

/** Strict native runtime-cache contract; latest duplicate key wins at its first list position. */
export function parseNativeRuntimeSourceCacheBackup(
  raw: string,
): NativeBackupRuntimeCache[] {
  const rows = new Map<string, NativeBackupRuntimeCache>();
  for (const row of strictRows(raw, 'runtimeSourceCache.json')) {
    const key = stringField(row.get('key'), 'runtimeSourceCache.json');
    if (
      !prefixes.some(
        prefix => key.startsWith(prefix) && key.length > prefix.length,
      )
    )
      return invalid('runtimeSourceCache.json');
    const item = row.get('value');
    const value =
      item?.kind === 'literal' && item.value === 'null'
        ? null
        : stringField(item, 'runtimeSourceCache.json');
    const token = row.get('deadline');
    if (token?.kind !== 'literal' || !/^-?\d+$/.test(token.value))
      return invalid('runtimeSourceCache.json');
    const deadline = BigInt(token.value);
    if (deadline < 0n || deadline > (1n << 63n) - 1n)
      return invalid('runtimeSourceCache.json');
    rows.set(key, { key, value, deadline: storeReadRecordLong(deadline) });
  }
  return [...rows.values()];
}
