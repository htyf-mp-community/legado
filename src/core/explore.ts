import type { BookSource, SearchBook } from '../types';
import { parseExploreEntries, type ExploreEntry } from './webBook';

export function selectExploreSources(sources: BookSource[], parse: (source: BookSource) => ExploreEntry[] = parseExploreEntries) {
  const available: BookSource[] = [];
  let failed = 0;
  for (const source of sources) {
    if (!source.enabled || !source.enabledExplore || !source.exploreUrl?.trim()) continue;
    try {
      if (parse(source).length) available.push(source);
    } catch {
      failed += 1;
    }
  }
  return { available, failed };
}

export function mergeExploreBooks(current: SearchBook[], incoming: SearchBook[]) {
  const result = [...current], seen = new Set(current.map(item => `${item.origin}\n${item.bookUrl}`));
  for (const item of incoming) {
    const key = `${item.origin}\n${item.bookUrl}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}
