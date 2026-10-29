import type { Book } from '../types';

/** BookSource uses 0/1/2/3/4; Android Book.type uses combinable flags. */
export function sourceTypeFromLegacyBookType(type: number) {
  if (type >= 0 && type <= 4) return type;
  if (type & 32) return 1;
  if (type & 64) return 2;
  if (type & 4) return 4;
  if (type & 128) return 3;
  return 0;
}
export function isLocalBook(
  book: Pick<Book, 'localUri' | 'origin' | 'nativeType'>,
) {
  return (
    !!book.localUri ||
    book.origin === 'loc_book' ||
    book.origin === 'local' ||
    book.origin?.startsWith('webDav::') === true ||
    !!((book.nativeType ?? 0) & 256)
  );
}
export function bookReadingScreen(
  book: Book,
): 'Reader' | 'AudioPlayer' | 'VideoBook' {
  return book.sourceType === 1
    ? 'AudioPlayer'
    : book.sourceType === 4
      ? 'VideoBook'
      : 'Reader';
}
