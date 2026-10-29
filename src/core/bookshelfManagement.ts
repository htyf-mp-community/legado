import type { Book, BookGroup, BookSource } from '../types';
import {
  booksInGroup,
  sortShelfBooks,
  userBookGroups,
} from './bookshelfGroups';
import { isLocalBook } from './bookKinds';
export type ManageGroupAction = 'move' | 'add' | 'remove';
export function manageShelfBooks(
  books: Book[],
  groups: BookGroup[],
  groupId: string,
  sort: number,
  query: string,
) {
  // Native management falls back to reading time for sort 5, unlike the main shelf's author sort.
  return sortShelfBooks(
    booksInGroup(books, groupId, groups),
    sort === 5 ? 0 : sort,
  ).filter(
    book =>
      !query ||
      [
        book.name,
        book.author,
        book.originName,
        book.origin,
        book.kind,
        book.intro,
      ].some(value => value?.includes(query)),
  );
}
export function selectAllManaged(
  visible: Book[],
  selected: ReadonlySet<string>,
  all: boolean,
) {
  return all
    ? new Set([...selected, ...visible.map(book => book.id)])
    : new Set<string>();
}
export function invertManagedSelection(
  visible: Book[],
  selected: ReadonlySet<string>,
) {
  const next = new Set(selected);
  visible.forEach(book => {
    if (!next.delete(book.id)) next.add(book.id);
  });
  return next;
}
export function assignManagedGroups(
  books: Book[],
  selected: ReadonlySet<string>,
  picked: ReadonlySet<string>,
  groups: BookGroup[],
  action: ManageGroupAction,
) {
  const allowed = new Set(userBookGroups(groups).map(group => group.id)),
    ids = [...picked].filter(id => allowed.has(id));
  return books.map(book =>
    !selected.has(book.id)
      ? book
      : {
          ...book,
          groupIds:
            action === 'move'
              ? ids
              : action === 'add'
                ? [...new Set([...(book.groupIds ?? []), ...ids])]
                : (book.groupIds ?? []).filter(id => !ids.includes(id)),
        },
  );
}
export function setManagedCanUpdate(
  books: Book[],
  selected: ReadonlySet<string>,
  canUpdate: boolean,
) {
  return books.map(book =>
    selected.has(book.id)
      ? {
          ...book,
          canUpdate,
          ...(!canUpdate
            ? {
                updateError: false,
                ...(book.nativeType === undefined
                  ? {}
                  : { nativeType: book.nativeType & ~16 }),
              }
            : {}),
        }
      : book,
  );
}
export function clearManagedTextCache(book: Book) {
  if (isLocalBook(book)) return book;
  return {
    ...book,
    content: '',
    chapters: book.chapters?.map(chapter => ({ ...chapter, content: '' })),
  };
}
export function usedShelfSources(books: Book[], sources: BookSource[]) {
  const used = new Set(
    books
      .filter(
        book =>
          !book.origin?.startsWith('loc_book') &&
          !book.origin?.startsWith('webDav::'),
      )
      .map(book => book.origin),
  );
  return sources.filter(source => used.has(source.bookSourceUrl));
}
/** Match adjacent native swaps; duplicate order values reset the global shelf while retaining filtered-out slots. */
export function reorderManagedBooks(
  books: Book[],
  visibleIds: string[],
  from: number,
  to: number,
) {
  const byId = new Map(books.map(book => [book.id, book])),
    visible = visibleIds.flatMap(id => (byId.has(id) ? [byId.get(id)!] : []));
  if (from < 0 || from >= visible.length) return books;
  to = Math.max(0, Math.min(visible.length - 1, to));
  if (from === to) return books;
  const order = new Map(visible.map(book => [book.id, book.order ?? 0]));
  let reset = false;
  const step = to > from ? 1 : -1;
  for (let index = from; index !== to; index += step) {
    const a = visible[index],
      b = visible[index + step],
      left = order.get(a.id)!,
      right = order.get(b.id)!;
    if (left === right) reset = true;
    else {
      order.set(a.id, right);
      order.set(b.id, left);
    }
    [visible[index], visible[index + step]] = [b, a];
  }
  if (reset) {
    const ids = new Set(visible.map(book => book.id)),
      all = sortShelfBooks(
        books.filter(book => !book.notShelf),
        3,
      );
    let cursor = 0;
    all
      .map(book => (ids.has(book.id) ? visible[cursor++] : book))
      .forEach((book, index) => order.set(book.id, index + 1));
  }
  return books.map(book =>
    order.has(book.id) ? { ...book, order: order.get(book.id)! } : book,
  );
}
