import { appStorage } from './storage';

export const RESTORE_IGNORE_KEY = 'backup.restore-ignore.v1';
export const restoreIgnoreKeys = [
  'readConfig',
  'themeMode',
  'themeConfig',
  'coverConfig',
  'bookshelfLayout',
  'showRss',
  'threadCount',
  'localBook',
  'ignoreCookies',
  'ignoreSourceVariables',
] as const;
export type RestoreIgnoreKey = (typeof restoreIgnoreKeys)[number];
export type RestoreIgnore = Record<RestoreIgnoreKey, boolean>;
export function normalizeRestoreIgnore(value: unknown): RestoreIgnore {
  const item =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  return Object.fromEntries(
    restoreIgnoreKeys.map(key => [key, item[key] === true]),
  ) as RestoreIgnore;
}
export function loadRestoreIgnore(): RestoreIgnore {
  try {
    return normalizeRestoreIgnore(
      JSON.parse(appStorage.getString(RESTORE_IGNORE_KEY) ?? '{}'),
    );
  } catch {
    return normalizeRestoreIgnore({});
  }
}
export function saveRestoreIgnore(value: Partial<RestoreIgnore>) {
  const next = normalizeRestoreIgnore(value);
  appStorage.set(RESTORE_IGNORE_KEY, JSON.stringify(next));
  return next;
}
