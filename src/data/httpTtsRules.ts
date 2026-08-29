import type { HttpTtsRule } from '../types';
import { appStorage } from './storage';
const KEY = 'http-tts.rules.v1';
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
export function normalizeHttpTtsRule(value: Record<string, unknown>, fallbackId = Date.now()): HttpTtsRule {
  const name = text(value.name), url = text(value.url);
  if (!name) throw new Error('HTTP TTS 规则缺少名称');
  if (!url) throw new Error(`${name} 缺少 URL 规则`);
  return { id: Number.isFinite(value.id) ? Number(value.id) : fallbackId, name, url, contentType: text(value.contentType) || undefined, pauseDuration: Number.isFinite(value.pauseDuration) ? Math.max(0, Math.min(10000, Number(value.pauseDuration))) : 0, concurrentRate: text(value.concurrentRate) || undefined, loginUrl: text(value.loginUrl) || undefined, loginUi: typeof value.loginUi === 'string' ? value.loginUi : value.loginUi ? JSON.stringify(value.loginUi) : undefined, header: typeof value.header === 'string' ? value.header : undefined, jsLib: typeof value.jsLib === 'string' ? value.jsLib : undefined, enabledCookieJar: value.enabledCookieJar === true, loginCheckJs: typeof value.loginCheckJs === 'string' ? value.loginCheckJs : undefined, lastUpdateTime: Number.isFinite(value.lastUpdateTime) ? Number(value.lastUpdateTime) : Date.now() };
}
export function parseHttpTtsRules(input: string): HttpTtsRule[] { let raw: unknown; try { raw = JSON.parse(input); } catch { throw new Error('HTTP TTS 规则不是有效的 JSON'); } const list = Array.isArray(raw) ? raw : [raw]; if (!list.length) throw new Error('HTTP TTS 规则列表为空'); return list.map((value, index) => { if (!value || typeof value !== 'object') throw new Error('HTTP TTS 条目必须是对象'); return normalizeHttpTtsRule(value as Record<string, unknown>, Date.now() + index); }); }
export function mergeHttpTtsRules(current: HttpTtsRule[], incoming: HttpTtsRule[]) { const map = new Map(current.map(rule => [rule.id, rule])); incoming.forEach(rule => map.set(rule.id, { ...map.get(rule.id), ...rule })); return [...map.values()].sort((a, b) => a.name.localeCompare(b.name)); }
export function loadHttpTtsRules(): HttpTtsRule[] { const raw = appStorage.getString(KEY); if (!raw) return []; try { return parseHttpTtsRules(raw); } catch { return []; } }
export function saveHttpTtsRules(rules: HttpTtsRule[]) { appStorage.set(KEY, JSON.stringify(rules)); }
export function exportHttpTtsRules(rules: HttpTtsRule[]) { return JSON.stringify(rules, null, 2); }
