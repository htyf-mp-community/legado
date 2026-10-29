import { appStorage } from './storage';
import { CronSchedule } from '../core/cronSchedule';

const KEY = 'auto.tasks.v1';
const SERVICE_KEY = 'auto.tasks.service.enabled.v1';
export const DEFAULT_AUTO_TASK_CRON = '*/30 * * * *';
export type AutoTaskRule = {
  id: string;
  name: string;
  enable: boolean;
  cron: string;
  loginUrl?: string;
  loginUi?: string;
  loginCheckJs?: string;
  comment?: string;
  script: string;
  header?: string;
  jsLib?: string;
  concurrentRate?: string;
  enabledCookieJar: boolean;
  customOrder: number;
  lastRunAt: number;
  lastResult?: string;
  lastError?: string;
  lastLog?: string;
};
const text = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';
const id = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export function normalizeAutoTask(
  value: Record<string, unknown>,
  fallbackOrder = 0,
): AutoTaskRule {
  const name = text(value.name),
    cron = text(value.cron) || DEFAULT_AUTO_TASK_CRON,
    script = typeof value.script === 'string' ? value.script : '';
  if (!name) throw new Error('定时任务缺少名称');
  if (!CronSchedule.parse(cron)) throw new Error(`${name} 的 Cron 计划无效`);
  if (!normalizeAutoTaskScript(script))
    throw new Error(`${name} 的任务脚本为空`);
  const optional = (key: string) => text(value[key]) || undefined;
  const runState = (key: string) =>
    typeof value[key] === 'string' ? value[key] : undefined;
  return {
    id: text(value.id) || id(),
    name,
    enable: value.enable !== false,
    cron,
    loginUrl: optional('loginUrl'),
    loginUi: optional('loginUi'),
    loginCheckJs: optional('loginCheckJs'),
    comment: optional('comment'),
    script,
    header: optional('header'),
    jsLib: optional('jsLib'),
    concurrentRate: optional('concurrentRate'),
    enabledCookieJar: value.enabledCookieJar !== false,
    customOrder: Number.isFinite(value.customOrder)
      ? Number(value.customOrder)
      : fallbackOrder,
    lastRunAt: Number.isFinite(value.lastRunAt) ? Number(value.lastRunAt) : 0,
    lastResult: runState('lastResult'),
    lastError: runState('lastError'),
    lastLog: runState('lastLog'),
  };
}
export function normalizeAutoTaskScript(script: string) {
  const value = script.trim();
  if (/^@js:/i.test(value)) return value.slice(4).trim();
  if (/^<js>/i.test(value) && /<\/js>$/i.test(value))
    return value.slice(4, -5).trim();
  return value;
}
export function parseAutoTasks(input: string): AutoTaskRule[] {
  let raw: unknown;
  try {
    raw = JSON.parse(input);
  } catch {
    throw new Error('定时任务不是有效的 JSON');
  }
  const list = Array.isArray(raw) ? raw : [raw];
  if (!list.length) throw new Error('定时任务列表为空');
  return list.map((value, index) => {
    if (!value || typeof value !== 'object')
      throw new Error('定时任务条目必须是对象');
    return normalizeAutoTask(value as Record<string, unknown>, index);
  });
}
export function loadAutoTasks(): AutoTaskRule[] {
  try {
    return loadAutoTasksStrict();
  } catch {
    return [];
  }
}
export function loadAutoTasksStrict(): AutoTaskRule[] {
  const raw = appStorage.getString(KEY);
  if (raw === undefined) return [];
  try {
    const stored: unknown = JSON.parse(raw);
    if (Array.isArray(stored) && stored.length === 0) return [];
    return parseAutoTasks(raw).sort(
      (a, b) => a.customOrder - b.customOrder || a.name.localeCompare(b.name),
    );
  } catch {
    throw new Error('定时任务数据无法读取，原始数据已保留');
  }
}
/** All updates read/transform/write synchronously, including results completing after an import or edit. */
export function updateAutoTasks(
  transform: (current: AutoTaskRule[]) => AutoTaskRule[],
) {
  const next = transform(loadAutoTasksStrict());
  saveAutoTasks(next);
  return next;
}
export function subscribeAutoTasks(changed: () => void) {
  const subscription = appStorage.addOnValueChangedListener(key => {
    if (key === KEY || key === SERVICE_KEY) changed();
  });
  return () => subscription.remove();
}
export function saveAutoTasks(tasks: AutoTaskRule[]) {
  appStorage.set(KEY, JSON.stringify(tasks));
}
export function loadAutoTaskServiceEnabled() {
  return appStorage.getString(SERVICE_KEY) === 'true';
}
export function saveAutoTaskServiceEnabled(enabled: boolean) {
  appStorage.set(SERVICE_KEY, String(enabled));
  return enabled;
}
export function mergeAutoTasks(
  current: AutoTaskRule[],
  incoming: AutoTaskRule[],
) {
  const map = new Map(current.map(task => [task.id, task])),
    localById = new Map(map),
    imported = new Set<string>();
  let nextOrder = Math.max(-1, ...current.map(task => task.customOrder)) + 1;
  incoming.forEach(task => {
    const old = localById.get(task.id),
      state = old ?? task,
      order =
        old?.customOrder ??
        (imported.has(task.id) ? map.get(task.id)!.customOrder : nextOrder++);
    map.set(task.id, {
      ...task,
      customOrder: order,
      lastRunAt: state.lastRunAt,
      lastResult: state.lastResult,
      lastError: state.lastError,
      lastLog: state.lastLog,
    });
    imported.add(task.id);
  });
  return [...map.values()].sort(
    (a, b) => a.customOrder - b.customOrder || a.name.localeCompare(b.name),
  );
}
export function exportAutoTasks(tasks: AutoTaskRule[]) {
  return JSON.stringify(
    tasks.map(
      ({
        customOrder: _order,
        lastRunAt: _at,
        lastResult: _result,
        lastError: _error,
        lastLog: _log,
        ...task
      }) => task,
    ),
    null,
    2,
  );
}
export function upsertAutoTask(tasks: AutoTaskRule[], rule: AutoTaskRule) {
  const old = tasks.find(item => item.id === rule.id),
    order =
      old?.customOrder ??
      Math.max(-1, ...tasks.map(item => item.customOrder)) + 1;
  return [
    ...tasks.filter(item => item.id !== rule.id),
    { ...rule, customOrder: order },
  ].sort((a, b) => a.customOrder - b.customOrder);
}
export function moveAutoTask(
  tasks: AutoTaskRule[],
  id: string,
  offset: -1 | 1,
) {
  const ordered = [...tasks].sort((a, b) => a.customOrder - b.customOrder),
    index = ordered.findIndex(item => item.id === id),
    target = index + offset;
  if (index < 0 || target < 0 || target >= ordered.length) return ordered;
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  return ordered.map((item, customOrder) => ({ ...item, customOrder }));
}
export function filterAutoTasks(tasks: AutoTaskRule[], query: string) {
  const value = query.trim().toLocaleLowerCase();
  return value
    ? tasks.filter(task => task.name.toLocaleLowerCase().includes(value))
    : tasks;
}
export function patchAutoTasks(
  tasks: AutoTaskRule[],
  ids: ReadonlySet<string>,
  patch: Partial<Pick<AutoTaskRule, 'enable' | 'cron'>>,
) {
  return tasks.map(task => (ids.has(task.id) ? { ...task, ...patch } : task));
}
