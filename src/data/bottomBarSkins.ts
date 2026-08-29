import { appStorage } from './storage';

export const BOTTOM_BAR_SKIN_SLOTS = [
  'bookshelf',
  'home',
  'notes',
  'settings',
] as const;
export type BottomBarSkinSlot = (typeof BOTTOM_BAR_SKIN_SLOTS)[number];
export type BottomBarSkinAssignment = { selected: string; normal?: string };
export type BottomBarSkin = {
  name: string;
  assignments: Partial<Record<BottomBarSkinSlot, BottomBarSkinAssignment>>;
  createdAt: number;
  updatedAt: number;
};

const LIST_KEY = 'bottom-bar.skins.v1';
const ACTIVE_KEY = 'bottom-bar.skin.active.v1';
const INVALID = /[\u0000-\u001f\u007f\\/:*?"<>|]/g;
const utf8Bytes = (value: string) =>
  encodeURIComponent(value).match(/%[0-9A-F]{2}|./gi)?.length ?? 0;

export function sanitizeBottomBarSkinName(value: string) {
  const clean = value.replace(INVALID, '_').trim().replace(/^\.+|\.+$/g, '');
  if (!clean) return 'skin';
  let result = '';
  for (const character of clean) {
    const next = result + character;
    if ([...next].length > 80 || utf8Bytes(next) > 240)
      break;
    result = next;
  }
  return result.trim().replace(/\.+$/g, '') || 'skin';
}

export function uniqueBottomBarSkinName(name: string, existing: string[]) {
  const base = sanitizeBottomBarSkinName(name);
  if (!existing.includes(base)) return base;
  for (let index = 2; ; index += 1) {
    const suffix = ` (${index})`;
    const stem = sanitizeBottomBarSkinName(base.slice(0, 80 - suffix.length));
    const candidate = `${stem}${suffix}`;
    if (!existing.includes(candidate)) return candidate;
  }
}

export function inferBottomBarSkinAssignments(images: string[]) {
  const result: Partial<Record<BottomBarSkinSlot, BottomBarSkinAssignment>> = {};
  for (const path of images) {
    const file = path.split(/[\\/]/).pop()?.toLowerCase() ?? '';
    const match = file.match(/^(bookshelf|home|notes|settings)_(selected|normal)\.(?:png|jpe?g|webp|bmp|gif)$/);
    if (!match) continue;
    const slot = match[1] as BottomBarSkinSlot;
    const current = result[slot] ?? { selected: '' };
    if (match[2] === 'selected') current.selected ||= path;
    else current.normal ||= path;
    result[slot] = current;
  }
  return result;
}

export function normalizeBottomBarSkins(value: unknown): BottomBarSkin[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const raw = item as Record<string, unknown>, name = sanitizeBottomBarSkinName(String(raw.name ?? ''));
    const rawAssignments = raw.assignments && typeof raw.assignments === 'object' ? raw.assignments as Record<string, unknown> : {};
    const assignments: BottomBarSkin['assignments'] = {};
    for (const slot of BOTTOM_BAR_SKIN_SLOTS) {
      const entry = rawAssignments[slot];
      if (!entry || typeof entry !== 'object') continue;
      const selected = String((entry as Record<string, unknown>).selected ?? '').trim();
      const normal = String((entry as Record<string, unknown>).normal ?? '').trim();
      if (selected) assignments[slot] = { selected, normal: normal || undefined };
    }
    if (!Object.keys(assignments).length) return [];
    return [{ name, assignments, createdAt: Math.max(0, Number(raw.createdAt) || index), updatedAt: Math.max(0, Number(raw.updatedAt) || index) }];
  });
}

export function loadBottomBarSkins() {
  try { return normalizeBottomBarSkins(JSON.parse(appStorage.getString(LIST_KEY) ?? '[]')); } catch { return []; }
}
export function saveBottomBarSkins(value: BottomBarSkin[]) {
  const normalized = normalizeBottomBarSkins(value);
  appStorage.set(LIST_KEY, JSON.stringify(normalized));
  const active = appStorage.getString(ACTIVE_KEY) ?? '';
  if (active && !normalized.some(item => item.name === active)) appStorage.remove(ACTIVE_KEY);
  return normalized;
}
export function loadActiveBottomBarSkinName() { return appStorage.getString(ACTIVE_KEY) ?? ''; }
export function saveActiveBottomBarSkinName(name: string) {
  if (!name) appStorage.remove(ACTIVE_KEY);
  else if (loadBottomBarSkins().some(item => item.name === name)) appStorage.set(ACTIVE_KEY, name);
}
export function loadActiveBottomBarSkin() {
  const name = loadActiveBottomBarSkinName();
  return loadBottomBarSkins().find(item => item.name === name);
}
