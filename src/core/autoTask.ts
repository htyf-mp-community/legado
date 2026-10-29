import { CronSchedule } from './cronSchedule';
import type { AutoTaskRule } from '../data/autoTasks';
import {
  loadAutoTasks,
  loadAutoTaskServiceEnabled,
  normalizeAutoTaskScript,
  updateAutoTasks,
} from '../data/autoTasks';
import { addAppLog } from '../data/appLog';
import { taskActions, taskString } from './autoTaskProtocol';
import { executeAutoTaskProtocolAction } from '../services/autoTaskProtocol';

export const FIRST_RUN_GRACE_MS = 5 * 60_000;
const baseTime = (task: AutoTaskRule, now: number) =>
  task.lastRunAt > 0 ? task.lastRunAt : now - FIRST_RUN_GRACE_MS;
export function dueAutoTasks(tasks: AutoTaskRule[], now = Date.now()) {
  return tasks.filter(
    task =>
      task.enable &&
      (CronSchedule.parse(task.cron)?.nextTimeAfter(baseTime(task, now)) ??
        Infinity) <= now,
  );
}
export function nextAutoTaskAt(
  tasks: AutoTaskRule[],
  now = Date.now(),
  afterBatch = false,
) {
  const times = tasks
    .filter(task => task.enable)
    .map(task =>
      CronSchedule.parse(task.cron)?.nextTimeAfter(
        afterBatch ? now : baseTime(task, now),
      ),
    )
    .filter((time): time is number => time !== undefined);
  return times.length ? Math.max(now, Math.min(...times)) : undefined;
}
const formatTime = (value: number) => {
  const date = new Date(value),
    pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};
export type AutoTaskRunResult = {
  success: boolean;
  result?: string;
  error?: string;
  log: string;
};
// TODO(htyf-native): Enable arbitrary tasks only after a sandbox runtime is version-pinned and bridged safely.
export async function runAutoTask(
  task: AutoTaskRule,
  fetcher: typeof fetch = fetch,
): Promise<AutoTaskRunResult> {
  const started = Date.now();
  try {
    const script = normalizeAutoTaskScript(task.script);
    if (!script) throw new Error('Task script is empty');
    let raw: unknown;
    const body =
      script.startsWith('(') && script.endsWith(')')
        ? script.slice(1, -1)
        : script;
    try {
      raw = JSON.parse(body);
    } catch {
      throw new Error(
        '当前 HTYF 运行时未提供 QuickJS，暂不能执行任意 JavaScript；可运行声明式 JSON 日志、HTTP 和目录更新任务',
      );
    }
    const actions = taskActions(raw),
      summaries: string[] = [];
    for (const action of actions) {
      const type = taskString(action, 'type')?.toLowerCase();
      if (type === 'http') {
        const url = String(action.url ?? '');
        if (!/^https?:\/\//i.test(url))
          throw new Error('HTTP 任务缺少有效 URL');
        const response = await fetcher(url, {
          method: String(action.method ?? 'GET'),
          headers: action.headers as Record<string, string> | undefined,
          body: typeof action.body === 'string' ? action.body : undefined,
        });
        const result = (await response.text()).slice(0, 500);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${result}`);
        if (actions.length === 1) raw = result;
      } else if (type === 'log') {
        if (actions.length === 1) raw = String(action.message ?? '');
      } else summaries.push(await executeAutoTaskProtocolAction(action, task));
    }
    const result =
        raw === null || raw === undefined
          ? undefined
          : String(raw).slice(0, 500),
      elapsed = Date.now() - started,
      log =
        `[OK] ${formatTime(Date.now())}\nElapsed: ${elapsed}ms${summaries.map(summary => `\n- ${summary}`).join('')}${result && result !== summaries.join(' | ') ? `\nResult: ${result}` : ''}`.slice(
          0,
          4000,
        );
    addAppLog(`AutoTask[${task.id}] ${task.name} completed`);
    return { success: true, result, log };
  } catch (error) {
    const message = (
      error instanceof Error ? error.message : String(error)
    ).slice(0, 1000);
    addAppLog(`AutoTask[${task.id}] ${task.name} failed`, error);
    return {
      success: false,
      error: message,
      log: `[ERROR] ${formatTime(Date.now())}\n${message}`.slice(0, 4000),
    };
  }
}

let activeBatch: Promise<number> | undefined;
export function recordAutoTaskRun(
  id: string,
  result: AutoTaskRunResult,
  lastRunAt = Date.now(),
) {
  return updateAutoTasks(current =>
    current.map(task =>
      task.id === id
        ? {
            ...task,
            lastRunAt,
            lastResult: result.result,
            lastError: result.error,
            lastLog: result.log,
          }
        : task,
    ),
  );
}
export function executeDueAutoTasks(
  now = Date.now(),
  respectService = false,
): Promise<number> {
  if (activeBatch) return activeBatch;
  activeBatch = (async () => {
    let count = 0;
    for (const task of dueAutoTasks(loadAutoTasks(), now)) {
      if (respectService && !loadAutoTaskServiceEnabled()) break;
      const result = await runAutoTask(task);
      try {
        recordAutoTaskRun(task.id, result);
      } catch (cause) {
        addAppLog(
          `AutoTask[${task.id}] could not persist run state; original data retained`,
          cause,
        );
      }
      count++;
    }
    return count;
  })().finally(() => {
    activeBatch = undefined;
  });
  return activeBatch;
}
// TODO(htyf-native): Cron tasks run only on foreground/resume until an approved background scheduler is configured; see docs/htyf-migration-gaps.md.
export function runDueAutoTasks(now = Date.now()): Promise<number> {
  if (!loadAutoTaskServiceEnabled()) return Promise.resolve(0);
  return executeDueAutoTasks(now, true);
}
