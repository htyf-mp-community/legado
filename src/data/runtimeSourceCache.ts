import { appStorage } from './storage';
import { compactGsonJson, parseGsonLegacyJson } from '../core/gsonJson';

const KEY = 'legacy.runtime-source-cache.v1';

/** Update one native-compatible row without discarding unrelated or corrupt data. */
export function writeRuntimeSourceCache(key: string, value: string | null) {
  const raw = appStorage.getString(KEY);
  if (raw === undefined && appStorage.getAllKeys?.().includes(KEY))
    throw new Error('书源变量缓存类型无效');
  let rows: unknown[] = [];
  if (raw !== undefined) {
    if (raw.length > 8_000_000) throw new Error('书源变量缓存过大');
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error();
      rows = parsed;
    } catch { throw new Error('书源变量缓存无法读取'); }
  }
  const filtered = rows.filter(row => !(row && typeof row === 'object' && !Array.isArray(row) && (row as {key?: unknown}).key === key));
  if (value !== null) filtered.push({key, value, deadline:0});
  if (filtered.length > 10_000) throw new Error('书源变量数量超过限制');
  const encoded = JSON.stringify(filtered);
  if (encoded.length > 8_000_000) throw new Error('书源变量缓存过大');
  if (raw !== undefined || value !== null) appStorage.set(KEY, encoded);
}

export function sourceRuntimeVariables(sourceKey: string) {
  return {
    get: (key: string) => readRuntimeSourceCache(`v_${sourceKey}_${key}`) ?? '',
    put: (key: string, value: string) => { writeRuntimeSourceCache(`v_${sourceKey}_${key}`, value); return value; },
    getVariable: () => readRuntimeSourceCache(`sourceVariable_${sourceKey}`) ?? '',
    setVariable: (value: string | null) => writeRuntimeSourceCache(`sourceVariable_${sourceKey}`, value),
  };
}

/** Reads restored native cache rows using CacheManager's exact expiry boundary. */
export function readRuntimeSourceCache(
  key: string,
  now = Date.now(),
): string | undefined {
  const raw = appStorage.getString(KEY);
  if (!raw) return undefined;
  try {
    const rows: unknown = JSON.parse(raw);
    if (!Array.isArray(rows)) return undefined;
    // Restored rows normally have unique keys; later rows take precedence if a
    // historical target backup contains duplicates.
    const row = [...rows]
      .reverse()
      .find(
        item =>
          item &&
          typeof item === 'object' &&
          !Array.isArray(item) &&
          item.key === key,
      ) as { value?: unknown; deadline?: unknown } | undefined;
    if (!row || typeof row.value !== 'string') return undefined;
    const deadline = row.deadline;
    if (
      !(
        (typeof deadline === 'number' && Number.isSafeInteger(deadline)) ||
        (typeof deadline === 'string' && /^\d+$/.test(deadline))
      )
    )
      return undefined;
    const expiry = BigInt(deadline);
    if (expiry !== 0n && expiry <= BigInt(now)) return undefined;
    return row.value;
  } catch {
    return undefined;
  }
}

/** Native BaseSource.getLoginHeaderMap for restored source-specific cache rows. */
export function restoredSourceLoginHeaders(
  sourceKey: string,
): Record<string, string> {
  const raw = readRuntimeSourceCache(`loginHeader_${sourceKey}`);
  if (raw === undefined) return {};
  try {
    const parsed = parseGsonLegacyJson(raw);
    if (parsed.kind !== 'object') return {};
    const entries: Array<[string, string]> = [];
    const seen = new Set<string>();
    for (const [key, value] of parsed.entries) {
      if (seen.has(key)) return {}; // Gson rejects duplicate non-null map keys.
      seen.add(key);
      if (value.kind === 'literal' && value.value === 'null') continue;
      entries.push([
        key,
        value.kind === 'string' || value.kind === 'literal'
          ? value.value
          : compactGsonJson(value),
      ]);
    }
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}
