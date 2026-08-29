import type { AutoTaskRule } from '../data/autoTasks';

export function parseAutoTaskHeaders(value?: string) {
  const text = value?.trim();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return Object.fromEntries(Object.entries(parsed as Record<string, unknown>).map(([key, item]) => [key, String(item)]));
  } catch {}
  return Object.fromEntries(text.split(/\r?\n/).map(line => { const separator = line.indexOf(':'); return separator > 0 ? [line.slice(0, separator).trim(), line.slice(separator + 1).trim()] : ['', '']; }).filter(([key]) => !!key));
}

export function autoTaskLoginConfig(task: AutoTaskRule) {
  const url = task.loginUrl?.trim() ?? '';
  return { id: `auto_task:${task.id}`, name: task.name, url, headers: parseAutoTaskHeaders(task.header), hasUnsupportedCheck: !!task.loginUi?.trim() || !!task.loginCheckJs?.trim() };
}
