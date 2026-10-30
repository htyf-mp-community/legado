import type { Book, BookSource, CoverRule } from '../types';
import { sourceRuleText } from './sourceRule';
import { buildSourceRequest, executeSourceRequest } from './sourceRequest';
import { UnsupportedRuleError } from './errors';
import { resolveNativeResourceUrl } from './nativeSourceUrl';

export async function searchBookCover(book: Book, rule: CoverRule) {
  if (!rule.enable || !rule.searchUrl.trim() || !rule.coverRule.trim()) return '';
  if (rule.coverRule.includes('@js:') || rule.coverRule.includes('<js>')) throw new UnsupportedRuleError('JavaScript 封面规则', '封面规则');
  const source: BookSource = { bookSourceUrl: /^https?:/i.test(rule.searchUrl) ? rule.searchUrl : 'https://cover-rule.invalid/', bookSourceName: '封面规则', bookSourceType: 0, customOrder: 0, enabled: true, enabledExplore: false, header: rule.header, enabledCookieJar: rule.enabledCookieJar };
  const request = buildSourceRequest(source, rule.searchUrl, book.name, 1), response = await executeSourceRequest(request), value = sourceRuleText(response.data, rule.coverRule, true);
  if (!value) return '';
  return resolveNativeResourceUrl(value, response.url);
}
