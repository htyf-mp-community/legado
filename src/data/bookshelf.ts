import type { Book, BookGroup } from '../types';
import { appStorage } from './storage';
const GROUPS = 'bookshelf.groups.v1',
  LAYOUT = 'bookshelf.layout.v1';
export type BookGroupSort = 0 | 1 | 2 | 3 | 4;
const sortKey = (groupId: string) =>
  `bookshelf.group-sort.v1.${encodeURIComponent(groupId)}`;
export function loadBookGroupSort(groupId: string): BookGroupSort {
  const value = appStorage.getNumber(sortKey(groupId));
  return value === 1 || value === 2 || value === 3 || value === 4 ? value : 0;
}
export function saveBookGroupSort(groupId: string, value: BookGroupSort) {
  appStorage.set(sortKey(groupId), value);
  return value;
}
export type BookshelfLayout = 'list' | 'grid';
export function loadBookGroups(): BookGroup[] {
  const raw = appStorage.getString(GROUPS);
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value)
      ? (value as BookGroup[]).sort((a, b) => a.order - b.order)
      : [];
  } catch {
    return [];
  }
}
export function saveBookGroups(groups: BookGroup[]) {
  appStorage.set(GROUPS, JSON.stringify(groups));
}
export function createBookGroup(
  name: string,
  groups: BookGroup[],
): BookGroup[] {
  const clean = name.trim();
  if (!clean) throw new Error('分组名称不能为空');
  if (groups.some(x => x.name === clean)) throw new Error('分组名称已存在');
  return [
    ...groups,
    {
      id: `group-${Date.now()}-${groups.length}`,
      name: clean,
      order: groups.length,
      show: true,
      enableRefresh: true,
    },
  ];
}
export function assignBooksToGroup(
  books: Book[],
  ids: Set<string>,
  groupId: string,
) {
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
  return {
    books: books.map(book => ({
      ...book,
      groupIds: (book.groupIds ?? []).filter(x => x !== groupId),
    })),
    groups: groups
      .filter(x => x.id !== groupId)
      .map((x, order) => ({ ...x, order })),
  };
}
export const loadBookshelfLayout = (): BookshelfLayout =>
  appStorage.getString(LAYOUT) === 'grid' ? 'grid' : 'list';
export function saveBookshelfLayout(layout: BookshelfLayout) {
  appStorage.set(LAYOUT, layout);
}
