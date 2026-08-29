import type { BookSource, SearchBook } from '../types';
import { UnsupportedRuleError } from './errors';
import { searchSource } from './webBook';

export type SourceCheckStatus = 'success' | 'empty' | 'unsupported' | 'failed';
export type SourceCheckResult = {
  sourceUrl: string;
  sourceName: string;
  status: SourceCheckStatus;
  count: number;
  durationMs: number;
  message: string;
};
type Search = (source: BookSource, keyword: string) => Promise<SearchBook[]>;

export async function checkBookSource(
  source: BookSource,
  keyword: string,
  search: Search = searchSource,
): Promise<SourceCheckResult> {
  const started = Date.now();
  try {
    const books = await search({ ...source, enabled: true }, keyword);
    return {
      sourceUrl: source.bookSourceUrl,
      sourceName: source.bookSourceName,
      status: books.length ? 'success' : 'empty',
      count: books.length,
      durationMs: Date.now() - started,
      message: books.length ? `找到 ${books.length} 条结果` : '搜索完成，但没有匹配结果',
    };
  } catch (cause) {
    const unsupported = cause instanceof UnsupportedRuleError,
      message = cause instanceof Error ? cause.message : String(cause);
    return {
      sourceUrl: source.bookSourceUrl,
      sourceName: source.bookSourceName,
      status: unsupported ? 'unsupported' : 'failed',
      count: 0,
      durationMs: Date.now() - started,
      message,
    };
  }
}

export async function checkBookSources(
  sources: BookSource[],
  keyword: string,
  options: {
    concurrency?: number;
    cancelled?: () => boolean;
    onResult?: (result: SourceCheckResult, completed: number, total: number) => void;
    search?: Search;
  } = {},
) {
  const results: SourceCheckResult[] = [],
    concurrency = Math.max(1, Math.min(12, options.concurrency ?? 4));
  let cursor = 0;
  const worker = async () => {
    while (!options.cancelled?.()) {
      const index = cursor++;
      if (index >= sources.length) return;
      const result = await checkBookSource(sources[index], keyword, options.search);
      results.push(result);
      options.onResult?.(result, results.length, sources.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, sources.length) }, worker));
  return results;
}
