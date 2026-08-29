import type { Bookmark, Highlight } from '../types';
import { appStorage } from './storage';
const BOOKMARKS = 'annotations.bookmarks.v1',
  HIGHLIGHTS = 'annotations.highlights.v1';
const read = <T>(key: string): T[] => {
  const raw = appStorage.getString(key);
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
};
const write = <T>(key: string, value: T[]) =>
  appStorage.set(key, JSON.stringify(value));
export const listBookmarks = (bookId?: string) =>
  read<Bookmark>(BOOKMARKS)
    .filter(x => !bookId || x.bookId === bookId)
    .sort((a, b) => b.createdAt - a.createdAt);
export function saveBookmark(value: Bookmark) {
  const all = read<Bookmark>(BOOKMARKS),
    index = all.findIndex(x => x.id === value.id);
  if (index >= 0) all[index] = value;
  else all.push(value);
  write(BOOKMARKS, all);
  return value;
}
export function removeBookmark(id: string) {
  write(
    BOOKMARKS,
    read<Bookmark>(BOOKMARKS).filter(x => x.id !== id),
  );
}
export const listHighlights = (bookId?: string) =>
  read<Highlight>(HIGHLIGHTS)
    .filter(x => !bookId || x.bookId === bookId)
    .sort((a, b) => b.createdAt - a.createdAt);
export function saveHighlight(value: Highlight) {
  if (value.end <= value.start || !value.text.trim())
    throw new Error('高亮范围无效');
  const all = read<Highlight>(HIGHLIGHTS),
    index = all.findIndex(x => x.id === value.id);
  if (index >= 0) all[index] = value;
  else all.push(value);
  write(HIGHLIGHTS, all);
  return value;
}
export function removeHighlight(id: string) {
  write(
    HIGHLIGHTS,
    read<Highlight>(HIGHLIGHTS).filter(x => x.id !== id),
  );
}
