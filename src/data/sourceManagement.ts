import type { BookSource } from '../types';
import { appStorage } from './storage';

const KEY = 'source-management.preferences.v1';
export type SourceSort = 'manual' | 'weight' | 'name' | 'url' | 'updated' | 'respond' | 'enabled';
export type SourceFilter = 'all' | 'enabled' | 'disabled' | 'login' | 'ungrouped' | 'exploreEnabled' | 'exploreDisabled' | `group:${string}`;
export type SourceManagementPreferences = { sort: SourceSort; ascending: boolean; filter: SourceFilter; groupByDomain: boolean };
export const defaultSourceManagementPreferences: SourceManagementPreferences = { sort: 'manual', ascending: true, filter: 'all', groupByDomain: false };

export function loadSourceManagementPreferences() {
  try { return { ...defaultSourceManagementPreferences, ...JSON.parse(appStorage.getString(KEY) ?? '{}') } as SourceManagementPreferences; } catch { return defaultSourceManagementPreferences; }
}
export function saveSourceManagementPreferences(value: SourceManagementPreferences) { appStorage.set(KEY, JSON.stringify(value)); }
export const sourceGroups = (sources: BookSource[]) => [...new Set(sources.flatMap(source => String(source.bookSourceGroup ?? '').split(/[,;，]/).map(value => value.trim()).filter(Boolean)))].sort((a, b) => a.localeCompare(b));
export function filterBookSources(sources: BookSource[], filter: SourceFilter, query = '') {
  const selected = sources.filter(source => filter === 'all' ? true : filter === 'enabled' ? source.enabled : filter === 'disabled' ? !source.enabled : filter === 'login' ? !!source.loginUrl || source.enabledCookieJar === true : filter === 'ungrouped' ? !String(source.bookSourceGroup ?? '').trim() : filter === 'exploreEnabled' ? source.enabledExplore : filter === 'exploreDisabled' ? !source.enabledExplore : filter.startsWith('group:') ? sourceGroups([source]).includes(filter.slice(6)) : true), q = query.trim().toLowerCase();
  return q ? selected.filter(source => `${source.bookSourceName} ${source.bookSourceUrl} ${source.bookSourceGroup ?? ''}`.toLowerCase().includes(q)) : selected;
}
export function sortBookSources(sources: BookSource[], sort: SourceSort, ascending: boolean) {
  const number = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const compare = (a: BookSource, b: BookSource) => sort === 'name' ? a.bookSourceName.localeCompare(b.bookSourceName) : sort === 'url' ? a.bookSourceUrl.localeCompare(b.bookSourceUrl) : sort === 'updated' ? number(b.lastUpdateTime) - number(a.lastUpdateTime) : sort === 'respond' ? number(a.respondTime, Number.MAX_SAFE_INTEGER) - number(b.respondTime, Number.MAX_SAFE_INTEGER) : sort === 'enabled' ? Number(b.enabled) - Number(a.enabled) || a.bookSourceName.localeCompare(b.bookSourceName) : sort === 'weight' ? number(a.weight) - number(b.weight) : number(a.customOrder) - number(b.customOrder);
  const result = [...sources].sort(compare); return ascending ? result : result.reverse();
}
export function sourceDomain(value: string) {
  try { return new URL(value).hostname.toLowerCase() || '#'; } catch { return '#'; }
}
export function sortBookSourcesByDomain(sources: BookSource[]) {
  return [...sources].sort((a, b) => { const left = sourceDomain(a.bookSourceUrl), right = sourceDomain(b.bookSourceUrl); return Number(left === '#') - Number(right === '#') || left.localeCompare(right) || Number(b.lastUpdateTime ?? 0) - Number(a.lastUpdateTime ?? 0); });
}
export function renameSourceGroup(sources: BookSource[], oldGroup: string, newGroup?: string) {
  const replacement = newGroup?.trim();
  return sources.map(source => { const current = groups(source.bookSourceGroup); if (!current.includes(oldGroup)) return source; const next = [...new Set(current.flatMap(item => item === oldGroup ? replacement ? [replacement] : [] : [item]))]; return { ...source, bookSourceGroup: next.join(',') || undefined }; });
}
export function assignUngroupedSources(sources: BookSource[], group: string) {
  const value = group.trim(); if (!value) return sources;
  return sources.map(source => groups(source.bookSourceGroup).length ? source : { ...source, bookSourceGroup: value });
}
const groups = (value: unknown) => String(value ?? '').split(/[,;，]/).map(item => item.trim()).filter(Boolean);
export function updateSelectedSources(sources: BookSource[], selected: Set<string>, action: 'enable' | 'disable' | 'enableExplore' | 'disableExplore' | 'top' | 'bottom' | 'addGroup' | 'removeGroup', group = '') {
  if (action === 'top' || action === 'bottom') { const chosen = sources.filter(source => selected.has(source.bookSourceUrl)), rest = sources.filter(source => !selected.has(source.bookSourceUrl)), ordered = action === 'top' ? [...chosen, ...rest] : [...rest, ...chosen]; return ordered.map((source, customOrder) => ({ ...source, customOrder })); }
  return sources.map(source => { if (!selected.has(source.bookSourceUrl)) return source; if (action === 'enable' || action === 'disable') return { ...source, enabled: action === 'enable' }; if (action === 'enableExplore' || action === 'disableExplore') return { ...source, enabledExplore: action === 'enableExplore' }; const current = groups(source.bookSourceGroup), next = action === 'addGroup' ? [...new Set([...current, group.trim()])].filter(Boolean) : current.filter(item => item !== group.trim()); return { ...source, bookSourceGroup: next.join(',') || undefined }; });
}
