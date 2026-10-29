import type { LocalChapter } from '../types';
export type TaskAction = Record<string, unknown>;
export const taskRecord = (value: unknown): TaskAction | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as TaskAction)
    : undefined;
export function taskValue(action: TaskAction, key: string) {
  return (
    action[key] ??
    Object.entries(action).find(
      ([name]) => name.toLowerCase() === key.toLowerCase(),
    )?.[1]
  );
}
export function taskString(action: TaskAction, key: string) {
  const value = taskValue(action, key);
  return value === null || value === undefined
    ? undefined
    : String(value).trim() || undefined;
}
export function taskBoolean(
  action: TaskAction,
  key: string,
  fallback: boolean,
) {
  const value = taskValue(action, key);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return nativeInt(value) !== 0;
  if (typeof value !== 'string' || !value.trim() || value === 'null')
    return fallback;
  return !/^(?:false|no|not|0|0\.0)$/i.test(value.trim());
}
const nativeInt = (value: number) =>
  Number.isNaN(value)
    ? 0
    : Math.max(-2147483648, Math.min(2147483647, Math.trunc(value)));
export function taskInteger(action: TaskAction, key: string) {
  const value = taskValue(action, key);
  if (typeof value === 'number') return nativeInt(value);
  if (typeof value !== 'string' || !/^[+-]?\d+$/.test(value)) return;
  const number = Number(value);
  return Number.isInteger(number) &&
    number >= -2147483648 &&
    number <= 2147483647
    ? number
    : undefined;
}
export function taskActions(value: unknown): TaskAction[] {
  if (Array.isArray(value))
    return value.flatMap(item => (taskRecord(item) ? [taskRecord(item)!] : []));
  const action = taskRecord(value);
  if (!action) return [];
  const actions = taskValue(action, 'actions');
  return Array.isArray(actions)
    ? taskActions(actions)
    : taskValue(action, 'type') !== undefined &&
        taskValue(action, 'type') !== null
      ? [action]
      : [];
}
export function countNewTaskChapters(
  before: LocalChapter[],
  after: LocalChapter[],
) {
  return Math.max(
    0,
    after.filter(chapter => !chapter.isVolume).length -
      before.filter(chapter => !chapter.isVolume).length,
  );
}
export function newTaskChapters(before: LocalChapter[], after: LocalChapter[]) {
  const count = countNewTaskChapters(before, after);
  if (!count) return [];
  const known = new Set(
    before.filter(chapter => !chapter.isVolume).map(chapter => chapter.url),
  );
  return after
    .filter(chapter => !chapter.isVolume && !known.has(chapter.url))
    .slice(-count);
}
export async function cacheTaskChapters(
  chapters: LocalChapter[],
  cache: (chapter: LocalChapter) => Promise<void>,
  onFailure: (chapter: LocalChapter, cause: unknown) => void,
  pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)),
) {
  let count = 0,
    firstFailure: unknown;
  for (const chapter of chapters) {
    let failure: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await cache(chapter);
        failure = undefined;
        count++;
        break;
      } catch (cause) {
        if (cause instanceof Error && cause.name === 'AbortError') throw cause;
        failure = cause ?? new Error(String(cause));
        if (attempt < 2) await pause(1000);
      }
    }
    if (failure !== undefined) {
      if (firstFailure === undefined) firstFailure = failure;
      onFailure(chapter, failure);
    }
  }
  if (firstFailure !== undefined) throw firstFailure;
  return count;
}
