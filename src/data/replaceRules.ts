import type { Book, ReplaceRule } from '../types';
import { appStorage } from './storage';
import { sqliteLike } from '../core/sqliteLike';
import { replaceJavaGroups } from '../core/javaReplacement';
import { compileSourceRegex } from '../core/sourceRegex';

const KEY = 'replace.rules.v1';

/** Native replacement scopes identify books by name and source origin, not the HTYF library ID. */
export function replacementContextForBook(book: Pick<Book, 'name' | 'origin'>) {
  return { name: book.name, origin: !book.origin || book.origin === 'local' ? 'loc_book' : book.origin };
}
const text = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';
const rawText = (value: unknown) => typeof value === 'string' ? value : '';
const nullableText = (value: unknown) => typeof value === 'string' ? value : undefined;

export function normalizeReplaceRule(
  value: Record<string, unknown>,
  fallbackId = Date.now(),
): ReplaceRule {
  const currentPattern = rawText(value.pattern);
  const legacy = !currentPattern && !!rawText(value.regex);
  const pattern = currentPattern || rawText(value.regex);
  if (!pattern) throw new Error('替换规则缺少匹配内容');
  const isRegex = legacy ? value.isRegex === true : value.isRegex !== false;
  if (isRegex) {
    try {
      compileSourceRegex(pattern, 'u');
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
    scope: legacy ? nullableText(value.useTo) : nullableText(value.scope),
    excludeScope: nullableText(value.excludeScope),
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
  const scope = rule.scope;
  const excluded = rule.excludeScope;
  const matches = (value: string) => sqliteLike(value, `%${name}%`) || sqliteLike(value, `%${origin}%`);
  return (
    (scope == null || scope === '' || matches(scope)) &&
    (excluded == null || !matches(excluded))
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

export type ReplaceRuleIssue = {
  rule: ReplaceRule;
  code: 'invalid-pattern' | 'invalid-replacement' | 'unsupported-script';
  message: string;
};

function replaceOnce(input: string, rule: ReplaceRule, target: 'title' | 'content' | 'source') {
  let code: ReplaceRuleIssue['code'] = 'invalid-pattern';
  try {
    let result: string;
    if (rule.isRegex) {
      const expression = compileSourceRegex(rule.pattern, 'u');
      code = 'invalid-replacement';
      if (rule.replacement.startsWith('@js:') && expression.test(input)) {
        code = 'unsupported-script';
        throw new Error('当前宿主尚未提供可中断的替换脚本执行环境');
      }
      expression.lastIndex = 0;
      result = replaceJavaGroups(input, expression, rule.replacement);
    } else result = input.split(rule.pattern).join(rule.replacement);
    // BookChapter keeps the previous display title if an individual rule blanks it.
    const blank = !/[^\t\n\x0B\f\r\x1C-\x20\p{Zs}\u2028\u2029]/u.test(result);
    return { value: target === 'title' && blank ? input : result };
  } catch (error) {
    return { value: input, issue: { rule, code, message: error instanceof Error ? error.message : String(error) } };
  }
}

export function runReplaceRules(
  input: string,
  rules: ReplaceRule[],
  target: 'title' | 'content' | 'source',
  context: { name: string; origin: string },
) {
  let value = input;
  const hits: ReplaceRule[] = [];
  const issues: ReplaceRuleIssue[] = [];
  applicableRules(rules, target, context).forEach(rule => {
    if (!rule.pattern) return;
    const next = replaceOnce(value, rule, target);
    if (next.issue) issues.push(next.issue);
    if (next.value !== value) hits.push(rule);
    value = next.value;
  });
  return { value, hits, issues };
}

export function effectiveReplaceRuleHits(
  ...args: Parameters<typeof runReplaceRules>
) {
  return runReplaceRules(...args).hits;
}

export function applyReplaceRules(
  input: string,
  rules: ReplaceRule[],
  target: 'title' | 'content' | 'source',
  context: { name: string; origin: string },
) {
  return runReplaceRules(input, rules, target, context).value;
}
