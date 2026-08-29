import type { HighlightRule, HighlightRuleStyle } from '../types';
import { appStorage } from './storage';

const KEY = 'highlight.rules.v1';
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const uuid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

export function parseHighlightStyle(value: string): HighlightRuleStyle {
  try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' ? parsed as HighlightRuleStyle : {}; }
  catch { return {}; }
}
export function normalizeHighlightRule(value: Record<string, unknown>, fallbackId = Date.now()): HighlightRule {
  const pattern = text(value.pattern);
  if (!pattern) throw new Error('高亮规则缺少匹配内容');
  const isRegex = value.isRegex === true;
  if (isRegex) { try { new RegExp(pattern, 'gu'); } catch { throw new Error(`正则表达式无效: ${pattern}`); } }
  const rawStyle = typeof value.style === 'string' ? value.style : JSON.stringify(value.style ?? {});
  return {
    id: Number.isFinite(value.id) ? Number(value.id) : fallbackId,
    uuid: text(value.uuid) || uuid(),
    name: text(value.name) || pattern,
    pattern,
    isRegex,
    scope: text(value.scope) || undefined,
    isEnabled: value.isEnabled !== false,
    style: JSON.stringify(parseHighlightStyle(rawStyle)),
    order: Number.isFinite(value.order) ? Number(value.order) : 0,
    timeoutMillisecond: Number.isFinite(value.timeoutMillisecond) && Number(value.timeoutMillisecond) > 0 ? Number(value.timeoutMillisecond) : 3000,
    applyToTitle: value.applyToTitle === true,
    applyToBody: value.applyToBody !== false,
  };
}
export function parseHighlightRules(input: string): HighlightRule[] {
  let raw: unknown;
  try { raw = JSON.parse(input); } catch { throw new Error('高亮规则不是有效的 JSON'); }
  if (raw && !Array.isArray(raw) && typeof raw === 'object' && (raw as Record<string, unknown>).type === 'highlightRule') raw = (raw as Record<string, unknown>).rules;
  const list = Array.isArray(raw) ? raw : [raw];
  if (!list.length) throw new Error('高亮规则列表为空');
  return list.map((value, index) => {
    if (!value || typeof value !== 'object') throw new Error('高亮规则条目必须是对象');
    return normalizeHighlightRule(value as Record<string, unknown>, Date.now() + index);
  });
}
export function mergeHighlightRules(current: HighlightRule[], incoming: HighlightRule[]) {
  const map = new Map(current.map(rule => [rule.uuid, rule]));
  incoming.forEach(rule => map.set(rule.uuid, { ...map.get(rule.uuid), ...rule }));
  return [...map.values()].sort((a, b) => a.order - b.order || a.id - b.id);
}
export function loadHighlightRules(): HighlightRule[] { const raw = appStorage.getString(KEY); if (!raw) return []; try { return parseHighlightRules(raw); } catch { return []; } }
export function saveHighlightRules(rules: HighlightRule[]) { appStorage.set(KEY, JSON.stringify(rules)); }
export function exportHighlightRules(rules: HighlightRule[]) { return JSON.stringify({ type: 'highlightRule', rules }, null, 2); }
