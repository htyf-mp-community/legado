import type { RssSource } from '../types';

const groups = (value: unknown) => String(value ?? '').split(/[,;，]/).map(item => item.trim()).filter(Boolean);
export type RssSourceFilter = 'all' | 'enabled' | 'disabled' | 'login' | 'ungrouped' | `group:${string}`;
export const rssSourceGroups = (sources: RssSource[]) => [...new Set(sources.flatMap(source => groups(source.sourceGroup)))].sort((a, b) => a.localeCompare(b));
export function filterRssSources(sources: RssSource[], filter: RssSourceFilter, query = '') {
  const selected = sources.filter(source => filter === 'all' ? true : filter === 'enabled' ? source.enabled : filter === 'disabled' ? !source.enabled : filter === 'login' ? !!source.loginUrl || source.enabledCookieJar === true : filter === 'ungrouped' ? !groups(source.sourceGroup).length : filter.startsWith('group:') ? groups(source.sourceGroup).includes(filter.slice(6)) : true), value = query.trim().toLowerCase();
  return (value ? selected.filter(source => `${source.sourceName} ${source.sourceGroup ?? ''} ${source.sourceUrl}`.toLowerCase().includes(value)) : selected).sort((a, b) => a.customOrder - b.customOrder || a.sourceName.localeCompare(b.sourceName));
}
export function updateSelectedRssSources(sources: RssSource[], selected: Set<string>, action: 'enable' | 'disable' | 'top' | 'bottom' | 'addGroup' | 'removeGroup', group = '') {
  if (action === 'top' || action === 'bottom') { const chosen = sources.filter(source => selected.has(source.sourceUrl)), rest = sources.filter(source => !selected.has(source.sourceUrl)), ordered = action === 'top' ? [...chosen, ...rest] : [...rest, ...chosen]; return ordered.map((source, customOrder) => ({ ...source, customOrder })); }
  return sources.map(source => { if (!selected.has(source.sourceUrl)) return source; if (action === 'enable' || action === 'disable') return { ...source, enabled: action === 'enable' }; const current = groups(source.sourceGroup), next = action === 'addGroup' ? [...new Set([...current, group.trim()])].filter(Boolean) : current.filter(item => item !== group.trim()); return { ...source, sourceGroup: next.join(',') || undefined }; });
}
export function renameRssSourceGroup(sources: RssSource[], oldGroup: string, newGroup?: string) {
  const replacement = newGroup?.trim(); return sources.map(source => { const current = groups(source.sourceGroup); if (!current.includes(oldGroup)) return source; const next = [...new Set(current.flatMap(item => item === oldGroup ? replacement ? [replacement] : [] : [item]))]; return { ...source, sourceGroup: next.join(',') || undefined }; });
}
export function assignUngroupedRssSources(sources: RssSource[], group: string) { const value = group.trim(); return value ? sources.map(source => groups(source.sourceGroup).length ? source : { ...source, sourceGroup: value }) : sources; }
