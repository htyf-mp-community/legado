import type { BookSource } from '../types';
import { UnsupportedRuleError } from './errors';
import { buildSourceRequest } from './sourceRequest';
import { sourceRuleValues } from './sourceRule';

export type SourceCompatibility = {
  search: 'supported' | 'unsupported';
  content: 'supported' | 'unsupported';
  issues: string[];
};

const rule = (source: BookSource, key: keyof BookSource) =>
  (source[key] ?? {}) as Record<string, unknown>;

const unsupported = (action: () => unknown) => {
  try {
    action();
    return false;
  } catch (error) {
    return error instanceof UnsupportedRuleError;
  }
};

/** Static preflight only; network failures are handled by source check/debug. */
export function inspectSourceCompatibility(
  source: BookSource,
): SourceCompatibility {
  const searchRule = rule(source, 'ruleSearch'),
    contentRule = rule(source, 'ruleContent'),
    searchUnsupported =
      !!source.searchUrl &&
      (unsupported(() => buildSourceRequest(source, source.searchUrl!, 'book')) ||
        unsupported(() =>
          sourceRuleValues('', String(searchRule.bookList ?? '$[*]')),
        )),
    contentUnsupported = unsupported(() =>
      sourceRuleValues('', contentRule.content),
    ),
    issues: string[] = [];
  if (searchUnsupported) issues.push('search-js');
  if (contentUnsupported) issues.push('content-js');
  return {
    search: searchUnsupported ? 'unsupported' : 'supported',
    content: contentUnsupported ? 'unsupported' : 'supported',
    issues,
  };
}

export function summarizeSourceCompatibility(sources: BookSource[]) {
  const inspected = sources.map(inspectSourceCompatibility);
  return {
    total: sources.length,
    searchable: inspected.filter(item => item.search === 'supported').length,
    searchBlocked: inspected.filter(item => item.search === 'unsupported').length,
    contentBlocked: inspected.filter(item => item.content === 'unsupported')
      .length,
  };
}
