import type { BookSource, DictRule } from '../types';
import { buildSourceRequest, executeSourceRequest } from './sourceRequest';
import { sourceRuleText } from './sourceRule';

export async function queryDictionary(rule: DictRule, word: string) {
  const key = word.trim();
  if (!key) throw new Error('请输入要查询的词语');
  if (!rule.enabled) throw new Error('字典规则未启用');
  const source: BookSource = {
    bookSourceUrl: /^https?:/i.test(rule.urlRule) ? rule.urlRule : 'https://dictionary.invalid/',
    bookSourceName: rule.name,
    bookSourceType: 0,
    customOrder: rule.sortNumber,
    enabled: true,
    enabledExplore: false,
  };
  const response = await executeSourceRequest(buildSourceRequest(source, rule.urlRule, key));
  if (!rule.showRule.trim())
    return typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2);
  return sourceRuleText(response.data, rule.showRule);
}
