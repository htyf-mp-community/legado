import { appStorage } from './storage';
const KEY = 'backup.preferences.v1';
export type BackupCategory =
  | 'bookshelf'
  | 'annotations'
  | 'sources'
  | 'rules'
  | 'history'
  | 'settings'
  | 'persistedCovers'
  | 'otherCovers'
  | 'backgrounds'
  | 'cookies'
  | 'sourceVariables';
export const backupCategories: BackupCategory[] = [
  'bookshelf',
  'annotations',
  'sources',
  'rules',
  'history',
  'settings',
  'persistedCovers',
  'otherCovers',
  'backgrounds',
  'cookies',
  'sourceVariables',
];
export type BackupPreferences = {
  categories: Record<BackupCategory, boolean>;
  onlyLatest: boolean;
  autoBackup: boolean;
  autoCheckNewBackup: boolean;
  deviceName: string;
  syncBookProgress: boolean;
  syncBookProgressPlus: boolean;
  webDavBookAutoRestore: boolean;
  lastBackup: number;
  lastCheckedRemote: number;
};
const all = Object.fromEntries(
  backupCategories.map(key => [key, true]),
) as Record<BackupCategory, boolean>;
export const defaultBackupPreferences: BackupPreferences = {
  categories: all,
  onlyLatest: true,
  autoBackup: true,
  autoCheckNewBackup: true,
  deviceName: 'HTYF',
  syncBookProgress: true,
  syncBookProgressPlus: false,
  webDavBookAutoRestore: false,
  lastBackup: 0,
  lastCheckedRemote: 0,
};
export function normalizeBackupPreferences(
  value: Partial<BackupPreferences>,
): BackupPreferences {
  return {
    ...defaultBackupPreferences,
    ...value,
    categories: { ...all, ...value.categories },
    deviceName:
      String(value.deviceName ?? 'HTYF')
        .trim()
        .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
        .slice(0, 64) || 'HTYF',
    lastBackup: Number.isFinite(value.lastBackup)
      ? Number(value.lastBackup)
      : 0,
    lastCheckedRemote: Number.isFinite(value.lastCheckedRemote)
      ? Number(value.lastCheckedRemote)
      : 0,
  };
}
export function loadBackupPreferences() {
  const raw = appStorage.getString(KEY);
  if (!raw) return defaultBackupPreferences;
  try {
    return normalizeBackupPreferences(
      JSON.parse(raw) as Partial<BackupPreferences>,
    );
  } catch {
    return defaultBackupPreferences;
  }
}
export function saveBackupPreferences(value: BackupPreferences) {
  const normalized = normalizeBackupPreferences(value);
  appStorage.set(KEY, JSON.stringify(normalized));
  return normalized;
}

const groups: Partial<Record<BackupCategory, RegExp[]>> = {
  bookshelf: [/^library\./, /^book\.groups\./, /^bookshelf\./],
  annotations: [/^annotations\./, /^bookmarks\./, /^highlights\.data\./],
  sources: [/^sources\./, /^rss\.sources\./],
  rules: [
    /^replace\./,
    /^txt\.toc\./,
    /^dictionary\./,
    /^highlight\.rules\./,
    /^cover\.rule\./,
    /^rule\.subscriptions\./,
    /^auto\.tasks\./,
    /^keyboard-assists\./,
    /^http\.tts\.engines\./,
  ],
  history: [
    /^read\.records\./,
    /^reading\.records\./,
    /^rss\.articles\./,
    /^browser\.history\./,
    /^download\./,
  ],
  cookies: [/^source-cookie\./],
  sourceVariables: [/^legacy\.runtime-source-cache\./],
};
export function backupCategoryForKey(key: string): BackupCategory {
  for (const [category, patterns] of Object.entries(groups) as [
    BackupCategory,
    RegExp[],
  ][])
    if (patterns.some(pattern => pattern.test(key))) return category;
  return 'settings';
}
export function shouldIncludeBackupKey(
  key: string,
  preferences = loadBackupPreferences(),
) {
  if (key === 'backup.restore-ignore.v1' || key === 'reading.record-sort.v1')
    return false;
  return preferences.categories[backupCategoryForKey(key)];
}
