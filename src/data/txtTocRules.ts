import type { TxtTocRule } from '../types';
import { appStorage } from './storage';

const KEY = 'txt.toc.rules.v1';
export const defaultTxtTocRules: TxtTocRule[] = [
  {
    id: 1,
    name: '中文章节',
    rule: '^[ \\t]*(第.{1,20}[章节卷集部篇回](?:[ \\t]+.*)?)[ \\t]*$',
    replacement: '$1',
    example: '第一章 故事开始',
    serialNumber: 0,
    enable: true,
  },
  {
    id: 2,
    name: '英文 Chapter',
    rule: '^[ \\t]*(Chapter[ \\t]+\\d+(?:[.:： \\t]+.*)?)[ \\t]*$',
    replacement: '$1',
    example: 'Chapter 1 Beginning',
    serialNumber: 1,
    enable: true,
  },
];

export function normalizeTxtTocRule(
  value: Record<string, unknown>,
  fallbackId = Date.now(),
): TxtTocRule {
  const rule = typeof value.rule === 'string' ? value.rule.trim() : '';
  if (!rule) throw new Error('TXT 目录规则不能为空');
  try {
    new RegExp(rule, 'gmu');
  } catch {
    throw new Error(`TXT 目录正则无效: ${rule}`);
  }
  return {
    id: Number.isFinite(value.id) ? Number(value.id) : fallbackId,
    name:
      typeof value.name === 'string' && value.name.trim()
        ? value.name.trim()
        : rule,
    rule,
    replacement:
      typeof value.replacement === 'string' ? value.replacement : '$&',
    example:
      typeof value.example === 'string' && value.example.trim()
        ? value.example
        : undefined,
    serialNumber: Number.isFinite(value.serialNumber)
      ? Number(value.serialNumber)
      : 0,
    enable: value.enable !== false,
  };
}
export function parseTxtTocRules(input: string): TxtTocRule[] {
  let raw: unknown;
  try {
    raw = JSON.parse(input);
  } catch {
    throw new Error('TXT 目录规则不是有效的 JSON');
  }
  const list = Array.isArray(raw) ? raw : [raw];
  if (!list.length) throw new Error('TXT 目录规则列表为空');
  return list.map((value, index) => {
    if (!value || typeof value !== 'object')
      throw new Error('规则条目必须是对象');
    return normalizeTxtTocRule(
      value as Record<string, unknown>,
      Date.now() + index,
    );
  });
}
export function mergeTxtTocRules(
  current: TxtTocRule[],
  incoming: TxtTocRule[],
) {
  const byId = new Map(current.map(rule => [rule.id, rule]));
  incoming.forEach(rule =>
    byId.set(rule.id, { ...byId.get(rule.id), ...rule }),
  );
  return [...byId.values()].sort(
    (a, b) => a.serialNumber - b.serialNumber || a.id - b.id,
  );
}
export function loadTxtTocRules(): TxtTocRule[] {
  const raw = appStorage.getString(KEY);
  if (!raw) return defaultTxtTocRules;
  try {
    return parseTxtTocRules(raw);
  } catch {
    return defaultTxtTocRules;
  }
}
export function saveTxtTocRules(rules: TxtTocRule[]) {
  appStorage.set(KEY, JSON.stringify(rules));
}
export function exportTxtTocRules(rules: TxtTocRule[]) {
  return JSON.stringify(rules, null, 2);
}
