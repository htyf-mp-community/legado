import type { Book, BookGroup } from '../types';
import { isLocalBook } from './bookKinds';

export const BUILT_IN_GROUPS: readonly BookGroup[] = [
  {
    id: '-1',
    name: '全部',
    order: -10,
    show: true,
    enableRefresh: true,
    bookSort: -1,
  },
  {
    id: '-2',
    name: '本地',
    order: -9,
    show: true,
    enableRefresh: false,
    bookSort: -1,
  },
  {
    id: '-3',
    name: '音频',
    order: -8,
    show: true,
    enableRefresh: true,
    bookSort: -1,
  },
  {
    id: '-4',
    name: '网络未分组',
    order: -7,
    show: true,
    enableRefresh: true,
    bookSort: -1,
  },
  {
    id: '-5',
    name: '本地未分组',
    order: -6,
    show: false,
    enableRefresh: true,
    bookSort: -1,
  },
  {
    id: '-6',
    name: '视频',
    order: -5,
    show: true,
    enableRefresh: true,
    bookSort: -1,
  },
  {
    id: '-11',
    name: '更新失败',
    order: -1,
    show: true,
    enableRefresh: true,
    bookSort: -1,
  },
];
const builtInIds = new Set(BUILT_IN_GROUPS.map(group => group.id));
export const canonicalGroupId = (id: string) => (id === 'all' ? '-1' : id);
export const isBuiltInGroup = (id: string) =>
  builtInIds.has(canonicalGroupId(id));
export const userBookGroups = (groups: BookGroup[]) =>
  groups.filter(group => !isBuiltInGroup(group.id));
export function bookMatchesGroup(
  book: Book,
  groupId: string,
  groups: BookGroup[],
  visibility = false,
) {
  const grouped =
    book.groupIds?.some(id =>
      userBookGroups(groups).some(group => group.id === id),
    ) === true;
  const local = isLocalBook(book),
    audio = book.sourceType === 1,
    video = book.sourceType === 4;
  switch (canonicalGroupId(groupId)) {
    case '-100':
      return (
        userBookGroups(groups).length > 0 &&
        !groups.some(group => group.id === '-4' && group.show) &&
        !local &&
        (book.sourceType ?? 0) === 0 &&
        !grouped
      );
    case '-1':
      return true;
    case '-2':
      return local;
    case '-3':
      return audio;
    case '-4':
      return !local && !audio && !video && !grouped;
    case '-5':
      return local && !grouped && (!visibility || (!audio && !video));
    case '-6':
      return video;
    case '-11':
      return book.updateError ?? !!((book.nativeType ?? 0) & 16);
    default:
      return book.groupIds?.includes(groupId) === true;
  }
}
export function visibleBookGroups(groups: BookGroup[], books: Book[]) {
  return groups
    .filter(
      group =>
        group.show &&
        (group.id === '-1' ||
          books.some(book => bookMatchesGroup(book, group.id, groups, true))),
    )
    .sort((left, right) => left.order - right.order);
}
export function booksInGroup(
  books: Book[],
  groupId: string,
  groups: BookGroup[],
) {
  return books.filter(
    book => !book.notShelf && bookMatchesGroup(book, groupId, groups),
  );
}
/** Source uses simplified-Chinese collation, independent of the application's UI language. */
export function sortShelfBooks(books: Book[], sort: number) {
  return [...books].sort((left, right) => {
    if (sort === 1)
      return (right.latestChapterTime ?? 0) - (left.latestChapterTime ?? 0);
    if (sort === 2) return left.name.localeCompare(right.name, 'zh-CN');
    if (sort === 3) return (left.order ?? 0) - (right.order ?? 0);
    if (sort === 4)
      return (
        Math.max(
          right.latestChapterTime ?? 0,
          right.durChapterTime ?? right.updatedAt,
        ) -
        Math.max(
          left.latestChapterTime ?? 0,
          left.durChapterTime ?? left.updatedAt,
        )
      );
    if (sort === 5) return left.author.localeCompare(right.author, 'zh-CN');
    return (
      (right.durChapterTime ?? right.updatedAt) -
      (left.durChapterTime ?? left.updatedAt)
    );
  });
}
export function setBooksGroups(
  books: Book[],
  selected: ReadonlySet<string>,
  groupIds: ReadonlySet<string>,
  groups: BookGroup[],
) {
  const allowed = new Set(userBookGroups(groups).map(group => group.id));
  const next = [...groupIds].filter(id => allowed.has(id));
  return books.map(book =>
    selected.has(book.id) ? { ...book, groupIds: next } : book,
  );
}
