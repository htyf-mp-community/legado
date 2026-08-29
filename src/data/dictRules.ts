import type { DictRule } from '../types';
import { appStorage } from './storage';

const KEY = 'dictionary.rules.v1';
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export function normalizeDictRule(value: Record<string, unknown>): DictRule {
  const name = text(value.name), urlRule = text(value.urlRule);
  if (!name) throw new Error('字典规则缺少名称');
  if (!urlRule) throw new Error(`${name} 缺少请求地址`);
  return {
    name,
    urlRule,
    showRule: typeof value.showRule === 'string' ? value.showRule : '',
    enabled: value.enabled !== false,
    sortNumber: Number.isFinite(value.sortNumber) ? Number(value.sortNumber) : 0,
  };
}

export function parseDictRules(input: string): DictRule[] {
  let raw: unknown;
  try { raw = JSON.parse(input); } catch { throw new Error('字典规则不是有效的 JSON'); }
  const list = Array.isArray(raw) ? raw : [raw];
  if (!list.length) throw new Error('字典规则列表为空');
  return list.map(value => {
    if (!value || typeof value !== 'object') throw new Error('字典规则条目必须是对象');
    return normalizeDictRule(value as Record<string, unknown>);
  });
}

export function mergeDictRules(current: DictRule[], incoming: DictRule[]) {
  const rules = new Map(current.map(rule => [rule.name, rule]));
  incoming.forEach(rule => rules.set(rule.name, { ...rules.get(rule.name), ...rule }));
  return [...rules.values()].sort((a, b) => b.sortNumber - a.sortNumber || a.name.localeCompare(b.name));
}

export function loadDictRules(): DictRule[] {
  const raw = appStorage.getString(KEY);
  if (!raw) return [];
  try { return parseDictRules(raw); } catch { return []; }
}
export function saveDictRules(rules: DictRule[]) { appStorage.set(KEY, JSON.stringify(rules)); }
export function exportDictRules(rules: DictRule[]) { return JSON.stringify(rules, null, 2); }
