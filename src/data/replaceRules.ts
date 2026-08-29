import type { ReplaceRule } from '../types';
import { appStorage } from './storage';

const KEY = 'replace.rules.v1';
const text = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

export function normalizeReplaceRule(
  value: Record<string, unknown>,
  fallbackId = Date.now(),
): ReplaceRule {
  const currentPattern = text(value.pattern);
  const legacy = !currentPattern && !!text(value.regex);
  const pattern = currentPattern || text(value.regex);
  if (!pattern) throw new Error('替换规则缺少匹配内容');
  const isRegex = legacy ? value.isRegex === true : value.isRegex !== false;
  if (isRegex) {
    try {
      new RegExp(pattern, 'gu');
    } catch {
      throw new Error(`正则表达式无效: ${pattern}`);
    }
    if (pattern.endsWith('|') && !pattern.endsWith('\\|'))
      throw new Error('正则表达式不能以未转义的 | 结尾');
  }
  return {
    id: Number.isFinite(value.id) ? Number(value.id) : fallbackId,
    name: text(value.name) || text(value.replaceSummary) || pattern,
    group: text(value.group) || undefined,
    pattern,
    replacement: typeof value.replacement === 'string' ? value.replacement : '',
    scope: text(value.scope) || text(value.useTo) || undefined,
    excludeScope: text(value.excludeScope) || undefined,
    scopeTitle: value.scopeTitle === true,
    scopeSource: value.scopeSource === true,
    scopeContent: value.scopeContent !== false,
    isEnabled: legacy
      ? value.enable === true
      : value.isEnabled !== false && value.enable !== false,
    isRegex,
    timeoutMillisecond:
      Number.isFinite(value.timeoutMillisecond) &&
      Number(value.timeoutMillisecond) > 0
        ? Number(value.timeoutMillisecond)
        : 3000,
    order: Number.isFinite(value.order)
      ? Number(value.order)
      : Number.isFinite(value.serialNumber)
        ? Number(value.serialNumber)
        : 0,
  };
}

export function parseReplaceRules(input: string): ReplaceRule[] {
  let raw: unknown;
  try {
    raw = JSON.parse(input);
  } catch {
    throw new Error('替换规则不是有效的 JSON');
  }
  const list = Array.isArray(raw) ? raw : [raw];
  if (!list.length) throw new Error('替换规则列表为空');
  return list.map((value, index) => {
    if (!value || typeof value !== 'object')
      throw new Error('替换规则条目必须是对象');
    return normalizeReplaceRule(
      value as Record<string, unknown>,
      Date.now() + index,
    );
  });
}

export function mergeReplaceRules(
  current: ReplaceRule[],
  incoming: ReplaceRule[],
) {
  const byId = new Map(current.map(rule => [rule.id, rule]));
  incoming.forEach(rule =>
    byId.set(rule.id, { ...byId.get(rule.id), ...rule }),
  );
  return [...byId.values()].sort((a, b) => a.order - b.order || a.id - b.id);
}
export function loadReplaceRules(): ReplaceRule[] {
  const raw = appStorage.getString(KEY);
  if (!raw) return [];
  try {
    return parseReplaceRules(raw);
  } catch {
    return [];
  }
}
export function saveReplaceRules(rules: ReplaceRule[]) {
  appStorage.set(KEY, JSON.stringify(rules));
}
export function exportReplaceRules(rules: ReplaceRule[]) {
  return JSON.stringify(rules, null, 2);
}

function applies(rule: ReplaceRule, name: string, origin: string) {
  const scope = rule.scope ?? '';
  const excluded = rule.excludeScope ?? '';
  return (
    (!scope || scope.includes(name) || scope.includes(origin)) &&
    (!excluded || (!excluded.includes(name) && !excluded.includes(origin)))
  );
}
const applicableRules = (
  rules: ReplaceRule[],
  target: 'title' | 'content' | 'source',
  context: { name: string; origin: string },
) =>
  rules
    .filter(
      rule =>
        rule.isEnabled &&
        (target === 'title'
          ? rule.scopeTitle
          : target === 'source'
            ? rule.scopeSource
            : rule.scopeContent) &&
        (target === 'source' || applies(rule, context.name, context.origin)),
    )
    .sort((a, b) => a.order - b.order);

function replaceOnce(input: string, rule: ReplaceRule) {
  try {
    return rule.isRegex
      ? input.replace(new RegExp(rule.pattern, 'gu'), rule.replacement)
      : input.split(rule.pattern).join(rule.replacement);
  } catch {
    return input;
  }
}

export function effectiveReplaceRuleHits(
  input: string,
  rules: ReplaceRule[],
  target: 'title' | 'content' | 'source',
  context: { name: string; origin: string },
) {
  let value = input;
  const hits: ReplaceRule[] = [];
  applicableRules(rules, target, context).forEach(rule => {
    const next = replaceOnce(value, rule);
    if (next !== value) hits.push(rule);
    value = next;
  });
  return hits;
}

export function applyReplaceRules(
  input: string,
  rules: ReplaceRule[],
  target: 'title' | 'content' | 'source',
  context: { name: string; origin: string },
) {
  return applicableRules(rules, target, context).reduce(replaceOnce, input);
}
