import { appStorage } from './storage';

const KEY = 'rule.subscriptions.v1';
export type RuleSubscriptionType = 0 | 1 | 2;
export type RuleSubscription = {
  id: string;
  name: string;
  url: string;
  type: RuleSubscriptionType;
  customOrder: number;
  autoUpdate: boolean;
  lastUpdateAt: number;
  updateInterval: number;
  silentUpdate: boolean;
  js?: string;
  showRule?: string;
  sourceUrl?: string;
};
export type RuleSubscriptionValidationCode = 'required-url' | 'invalid-type' | 'invalid-json' | 'empty-list' | 'invalid-entry' | 'duplicate-url';
export class RuleSubscriptionValidationError extends Error {
  constructor(readonly code: RuleSubscriptionValidationCode, readonly duplicateName?: string) {
    const defaults: Record<RuleSubscriptionValidationCode, string> = {
      'required-url': '规则订阅地址不能为空',
      'invalid-type': '规则订阅类型无效',
      'invalid-json': '规则订阅不是有效的 JSON',
      'empty-list': '规则订阅列表为空',
      'invalid-entry': '规则订阅条目必须是对象',
      'duplicate-url': `订阅地址已存在（${duplicateName ?? ''}）`,
    };
    super(defaults[code]);
    this.name = 'RuleSubscriptionValidationError';
  }
}

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
export function normalizeRuleSubscription(value: Record<string, unknown>, fallbackOrder = 0): RuleSubscription {
  const url = text(value.url), type = Number(value.type);
  if (!url) throw new RuleSubscriptionValidationError('required-url');
  if (![0, 1, 2].includes(type)) throw new RuleSubscriptionValidationError('invalid-type');
  return {
    id: text(value.id) || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: text(value.name) || url,
    url,
    type: type as RuleSubscriptionType,
    customOrder: Number.isFinite(value.customOrder) ? Number(value.customOrder) : fallbackOrder,
    autoUpdate: value.autoUpdate === true,
    lastUpdateAt: Number.isFinite(value.lastUpdateAt) ? Number(value.lastUpdateAt) : Number.isFinite(value.update) ? Number(value.update) : 0,
    updateInterval: Number.isFinite(value.updateInterval) ? Math.max(0, Number(value.updateInterval)) : 0,
    silentUpdate: value.silentUpdate === true,
    js: text(value.js) || undefined,
    showRule: text(value.showRule) || undefined,
    sourceUrl: text(value.sourceUrl) || undefined,
  };
}
export function parseRuleSubscriptions(input: string) {
  let raw: unknown;
  try { raw = JSON.parse(input); } catch { throw new RuleSubscriptionValidationError('invalid-json'); }
  const list = Array.isArray(raw) ? raw : [raw];
  if (!list.length) throw new RuleSubscriptionValidationError('empty-list');
  return list.map((value, index) => {
    if (!value || typeof value !== 'object') throw new RuleSubscriptionValidationError('invalid-entry');
    return normalizeRuleSubscription(value as Record<string, unknown>, index);
  });
}
export function loadRuleSubscriptions(): RuleSubscription[] {
  const raw = appStorage.getString(KEY);
  if (!raw) return [];
  try { return parseRuleSubscriptions(raw).sort((a, b) => a.customOrder - b.customOrder); } catch { return []; }
}
export function saveRuleSubscriptions(value: RuleSubscription[]) { appStorage.set(KEY, JSON.stringify(value)); }
export function upsertRuleSubscription(current: RuleSubscription[], value: RuleSubscription) {
  const duplicate = current.find(item => item.url === value.url && item.id !== value.id);
  if (duplicate) throw new RuleSubscriptionValidationError('duplicate-url', duplicate.name);
  const old = current.find(item => item.id === value.id), customOrder = old?.customOrder ?? Math.max(-1, ...current.map(item => item.customOrder)) + 1;
  return [...current.filter(item => item.id !== value.id), { ...value, customOrder }].sort((a, b) => a.customOrder - b.customOrder);
}
export function moveRuleSubscription(current: RuleSubscription[], id: string, direction: -1 | 1) {
  const sorted = [...current].sort((a, b) => a.customOrder - b.customOrder), index = sorted.findIndex(item => item.id === id), target = index + direction;
  if (index < 0 || target < 0 || target >= sorted.length) return sorted;
  [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
  return sorted.map((item, customOrder) => ({ ...item, customOrder }));
}
export function setRuleSubscriptionAutoUpdate(value: RuleSubscription, autoUpdate: boolean) {
  return { ...value, autoUpdate, updateInterval: autoUpdate ? value.updateInterval || 24 : 0, silentUpdate: autoUpdate ? value.silentUpdate : false };
}
export function setRuleSubscriptionInterval(value: RuleSubscription, input: string) {
  const updateInterval = Math.max(0, Number(input) || 0);
  return { ...value, updateInterval, autoUpdate: updateInterval > 0, silentUpdate: updateInterval > 0 ? value.silentUpdate : false };
}
export const exportRuleSubscriptions = (value: RuleSubscription[]) => JSON.stringify(value, null, 2);
export function isRuleSubscriptionDue(value: RuleSubscription, now = Date.now()) {
  return value.autoUpdate && value.updateInterval > 0 && value.lastUpdateAt + value.updateInterval * 3600_000 <= now;
}
