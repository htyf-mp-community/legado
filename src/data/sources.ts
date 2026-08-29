import type { BookSource } from '../types';
import { appStorage } from './storage';
const KEY = 'sources.v1';
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
export function parseBookSources(input: string): BookSource[] {
  let raw: unknown;
  try {
    raw = JSON.parse(input);
  } catch {
    throw new Error('书源不是有效的 JSON');
  }
  const list = Array.isArray(raw) ? raw : [raw];
  if (!list.length) throw new Error('书源列表为空');
  const out: BookSource[] = [];
  for (const value of list) {
    if (!value || typeof value !== 'object')
      throw new Error('书源条目必须是对象');
    const x = value as Record<string, unknown>,
      url = text(x.bookSourceUrl),
      name = text(x.bookSourceName);
    if (!url || !name) throw new Error('书源缺少名称或地址');
    out.push({
      ...x,
      bookSourceUrl: url,
      bookSourceName: name,
      bookSourceGroup: text(x.bookSourceGroup) || undefined,
      bookSourceType: Number.isFinite(x.bookSourceType)
        ? Number(x.bookSourceType)
        : 0,
      customOrder: Number.isFinite(x.customOrder) ? Number(x.customOrder) : 0,
      enabled: x.enabled !== false,
      enabledExplore: x.enabledExplore !== false,
    } as BookSource);
  }
  return out;
}
export function mergeBookSources(
  current: BookSource[],
  incoming: BookSource[],
) {
  const map = new Map(current.map(x => [x.bookSourceUrl, x]));
  incoming.forEach(x =>
    map.set(x.bookSourceUrl, { ...map.get(x.bookSourceUrl), ...x }),
  );
  return [...map.values()].sort(
    (a, b) =>
      b.customOrder - a.customOrder ||
      a.bookSourceName.localeCompare(b.bookSourceName),
  );
}
export function exportBookSources(sources: BookSource[]): string {
  return JSON.stringify(sources, null, 2);
}
export function upsertBookSource(
  current: BookSource[],
  source: BookSource,
  previousUrl = source.bookSourceUrl,
): BookSource[] {
  return mergeBookSources(
    current.filter(
      item =>
        item.bookSourceUrl !== previousUrl &&
        item.bookSourceUrl !== source.bookSourceUrl,
    ),
    [source],
  );
}
export async function loadSources(): Promise<BookSource[]> {
  const raw = appStorage.getString(KEY);
  if (!raw) return [];
  try {
    return parseBookSources(raw);
  } catch {
    return [];
  }
}
export async function saveSources(value: BookSource[]) {
  appStorage.set(KEY, JSON.stringify(value));
}
