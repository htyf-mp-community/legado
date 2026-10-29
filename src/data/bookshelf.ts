import type { Book, BookGroup } from '../types';
import { appStorage } from './storage';
import {
  BUILT_IN_GROUPS,
  canonicalGroupId,
  isBuiltInGroup,
  userBookGroups,
} from '../core/bookshelfGroups';

export const BOOK_GROUPS_KEY = 'bookshelf.groups.v1';
const LAYOUT = 'bookshelf.layout.v1',
  ACTIVE = 'bookshelf.active-group.v1',
  SORT = 'bookshelf.sort.v1';
export type BookGroupSort = 0 | 1 | 2 | 3 | 4 | 5;
const validSort = (value: unknown): value is BookGroupSort =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= 5;
const sortKey = (id: string) =>
  `bookshelf.group-sort.v1.${encodeURIComponent(id)}`;
const legacySort = (id: string) =>
  appStorage.getNumber(sortKey(id === '-1' ? 'all' : id));
export const loadBookshelfSort = (): BookGroupSort => {
  const value = appStorage.getNumber(SORT);
  return validSort(value) ? value : 0;
};
export function saveBookshelfSort(value: BookGroupSort) {
  appStorage.set(SORT, value);
  return value;
}

function normalizeGroups(input: unknown): BookGroup[] {
  if (!Array.isArray(input)) throw new Error('分组数据不是有效的数组');
  const groups = new Map(
    BUILT_IN_GROUPS.map(group => [group.id, { ...group }]),
  );
  input.forEach((value, index) => {
    if (
      !value ||
      typeof value !== 'object' ||
      typeof value.id !== 'string' ||
      !value.id ||
      typeof value.name !== 'string'
    )
      throw new Error('分组条目无效');
    const id = canonicalGroupId(value.id),
      original = groups.get(id);
    const savedSort = value.bookSort ?? legacySort(id);
    groups.set(id, {
      ...value,
      id,
      name: value.name,
      order: Number.isFinite(value.order)
        ? value.order
        : (original?.order ?? index),
      show: value.show !== false,
      enableRefresh: value.enableRefresh !== false,
      onlyUpdateRead: value.onlyUpdateRead === true,
      bookSort: validSort(savedSort) ? savedSort : -1,
    });
  });
  // Existing per-group sorting from the migration's older schema remains effective.
  for (const group of groups.values()) {
    if (!input.some(value => canonicalGroupId(value.id) === group.id)) {
      const saved = legacySort(group.id);
      if (validSort(saved)) group.bookSort = saved;
    }
  }
  return [...groups.values()].sort((left, right) => left.order - right.order);
}
export type BookGroupsSnapshot = { groups: BookGroup[]; error?: string };
let cachedRaw: string | undefined, cached: BookGroupsSnapshot | undefined;
export function getBookGroupsSnapshot(): BookGroupsSnapshot {
  const raw = appStorage.getString(BOOK_GROUPS_KEY);
  if (cached && raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    cached = {
      groups: normalizeGroups(raw === undefined ? [] : JSON.parse(raw)),
    };
  } catch (error) {
    cached = {
      groups: BUILT_IN_GROUPS.map(group => ({ ...group })),
      error: error instanceof Error ? error.message : String(error),
    };
  }
  return cached;
}
export function subscribeBookGroups(changed: () => void) {
  const listener = appStorage.addOnValueChangedListener(key => {
    if (
      key === BOOK_GROUPS_KEY ||
      key === SORT ||
      key.startsWith('bookshelf.group-sort.v1.')
    ) {
      cached = undefined;
      changed();
    }
  });
  return () => listener.remove();
}
export function loadBookGroups(): BookGroup[] {
  return getBookGroupsSnapshot().groups;
}
export function saveBookGroups(groups: BookGroup[]) {
  const next = normalizeGroups(groups);
  cached = undefined;
  appStorage.set(BOOK_GROUPS_KEY, JSON.stringify(next));
  return next;
}
export function loadBookGroupSort(id: string): BookGroupSort {
  const value =
    loadBookGroups().find(group => group.id === canonicalGroupId(id))
      ?.bookSort ?? legacySort(id);
  return validSort(value) ? value : loadBookshelfSort();
}
export function saveBookGroupSort(id: string, value: BookGroupSort) {
  const groupId = canonicalGroupId(id);
  const groups = loadBookGroups(),
    index = groups.findIndex(group => group.id === groupId);
  if (index >= 0)
    saveBookGroups(
      groups.map(group =>
        group.id === groupId ? { ...group, bookSort: value } : group,
      ),
    );
  else {
    appStorage.set(sortKey(id), value);
    cached = undefined;
  }
  return value;
}
export const loadActiveBookGroup = () =>
  canonicalGroupId(appStorage.getString(ACTIVE) ?? '-1');
export function saveActiveBookGroup(id: string) {
  appStorage.set(ACTIVE, canonicalGroupId(id));
  return canonicalGroupId(id);
}

export function createBookGroup(
  name: string,
  groups: BookGroup[],
): BookGroup[] {
  const clean = name,
    custom = userBookGroups(groups);
  if (!clean) throw new Error('分组名称不能为空');
  if (custom.length >= 63) throw new Error('分组已达上限(63个)');
  let occupied = 0n;
  for (const group of custom) {
    try {
      const value = BigInt(group.id);
      if (value > 0n) occupied |= value;
    } catch {}
  }
  let id = 1n;
  while (occupied & id) id <<= 1n;
  if (id > 1n << 62n) throw new Error('分组已达上限(63个)');
  return [
    ...groups,
    {
      id: String(id),
      name: clean,
      order: Math.max(0, ...custom.map(group => group.order)) + 1,
      show: true,
      enableRefresh: true,
      onlyUpdateRead: false,
      bookSort: -1,
    },
  ];
}
export function assignBooksToGroup(
  books: Book[],
  ids: Set<string>,
  groupId: string,
) {
  if (isBuiltInGroup(groupId)) return books;
  return books.map(book =>
    ids.has(book.id)
      ? { ...book, groupIds: [...new Set([...(book.groupIds ?? []), groupId])] }
      : book,
  );
}
export function removeGroup(
  books: Book[],
  groups: BookGroup[],
  groupId: string,
) {
  if (isBuiltInGroup(groupId)) throw new Error('内置分组不能删除');
  return {
    books: books.map(book => ({
      ...book,
      groupIds: (book.groupIds ?? []).filter(id => id !== groupId),
    })),
    groups: groups
      .filter(group => group.id !== groupId)
      .map((group, order) => ({ ...group, order })),
  };
}
export function moveBookGroup(groups: BookGroup[], id: string, offset: number) {
  const from = groups.findIndex(group => group.id === id),
    to = Math.max(0, Math.min(groups.length - 1, from + offset));
  if (from < 0 || to === from) return groups;
  const next = [...groups];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next.map((group, index) => ({ ...group, order: index + 1 }));
}
export type BookshelfLayout = 'list' | 'grid';
export const loadBookshelfLayout = (): BookshelfLayout =>
  appStorage.getString(LAYOUT) === 'grid' ? 'grid' : 'list';
export function saveBookshelfLayout(layout: BookshelfLayout) {
  appStorage.set(LAYOUT, layout);
}
