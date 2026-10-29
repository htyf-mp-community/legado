import type { Book } from '../types';
export type BookCoverLayers = Pick<
  Book,
  'origin' | 'coverUrl' | 'customCoverUrl' | 'persistedCoverUrl'
>;
export const displayBookCover = (book: BookCoverLayers) =>
  book.persistedCoverUrl || book.customCoverUrl || book.coverUrl;
export const editableBookCover = (book: BookCoverLayers) =>
  book.customCoverUrl || book.coverUrl;
export const networkBookCover = (book: BookCoverLayers) => {
  const value = editableBookCover(book);
  return value && /^https?:\/\//i.test(value) ? value : undefined;
};
const networkOrigin = (value: string) => {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol) || !url.hostname) return;
    // Preserve explicit ports, as NetworkUtils.getBaseUrl uses URL.authority.
    return value.match(/^https?:\/\/[^/?#]+/i)?.[0].toLowerCase();
  } catch {
    return;
  }
};
export function coverSourceOrigin(book: BookCoverLayers, persisted = true) {
  if (persisted && book.persistedCoverUrl) return;
  if (!book.customCoverUrl) return book.origin;
  const origin = networkOrigin(book.origin ?? '');
  return origin && origin === networkOrigin(book.customCoverUrl)
    ? book.origin
    : undefined;
}
export const coverImageUri = (path: string) =>
  path.startsWith('/')
    ? `file://${path.split('/').map(encodeURIComponent).join('/')}`
    : path;
export function normalizeLegacyCover<T extends BookCoverLayers>(
  book: T,
): T & BookCoverLayers {
  if (
    !book.persistedCoverUrl &&
    /^\/(?:.*\/)?covers\/[a-f\d]{32}\.cover$/i.test(book.customCoverUrl ?? '')
  )
    return {
      ...book,
      persistedCoverUrl: book.customCoverUrl,
      customCoverUrl: undefined,
    };
  return book;
}
export function editBookCover(book: Book, value: string): Book {
  const edited = value || undefined;
  return {
    ...book,
    customCoverUrl: edited === book.coverUrl ? undefined : edited,
    persistedCoverUrl:
      edited !== (editableBookCover(book) || undefined)
        ? undefined
        : book.persistedCoverUrl,
  };
}
export function coverSnapshotMatches(current: Book, before: Book) {
  return (
    current.id === before.id &&
    current.bookUrl === before.bookUrl &&
    current.origin === before.origin &&
    (current.coverUrl ?? null) === (before.coverUrl ?? null) &&
    (current.customCoverUrl ?? null) === (before.customCoverUrl ?? null) &&
    (current.persistedCoverUrl ?? null) === (before.persistedCoverUrl ?? null)
  );
}
