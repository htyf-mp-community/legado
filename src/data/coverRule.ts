import type { CoverRule } from '../types';
import { appStorage } from './storage';

const KEY = 'cover.rule.v1';
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
export const defaultCoverRule: CoverRule = { enable: false, searchUrl: '', coverRule: '', enabledCookieJar: false };
export function normalizeCoverRule(value: Record<string, unknown>): CoverRule {
  return { enable: value.enable !== false, searchUrl: text(value.searchUrl), coverRule: text(value.coverRule), concurrentRate: text(value.concurrentRate) || undefined, loginUrl: text(value.loginUrl) || undefined, loginUi: typeof value.loginUi === 'string' ? value.loginUi : value.loginUi ? JSON.stringify(value.loginUi) : undefined, header: typeof value.header === 'string' ? value.header : undefined, jsLib: typeof value.jsLib === 'string' ? value.jsLib : undefined, enabledCookieJar: value.enabledCookieJar === true };
}
export function parseCoverRule(input: string) { let raw: unknown; try { raw = JSON.parse(input); } catch { throw new Error('封面规则不是有效的 JSON'); } if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('封面规则必须是对象'); return normalizeCoverRule(raw as Record<string, unknown>); }
export function loadCoverRule(): CoverRule { const raw = appStorage.getString(KEY); if (!raw) return defaultCoverRule; try { return parseCoverRule(raw); } catch { return defaultCoverRule; } }
export function saveCoverRule(rule: CoverRule) { const value = normalizeCoverRule(rule as unknown as Record<string, unknown>); appStorage.set(KEY, JSON.stringify(value)); return value; }
export function clearCoverRule() { appStorage.remove(KEY); }
export function exportCoverRule(rule: CoverRule) { return JSON.stringify(rule, null, 2); }
