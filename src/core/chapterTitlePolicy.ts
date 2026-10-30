import { createHash } from 'react-native-quick-crypto';
import type { Book } from '../types';

/** Native BookChapter's index/title-MD5 .nr identity, scoped to its book. */
export function chapterTitleRemovalKey(index: number, title: string): string {
  const value = Math.trunc(index);
  const formatted = value < 0
    ? '-' + String(-value).padStart(4, '0')
    : String(value).padStart(5, '0');
  const hash = createHash('md5');
  hash.update(title, 'utf8');
  return `${formatted}-${hash.digest('hex').slice(8, 24)}.nr`;
}

/**
 * Native removal is enabled by default; .nr entries explicitly retain a
 * chapter's title. This updates only the exclusion metadata, never raw content.
 */
export function setChapterTitleRemoval(book: Book, key: string, enabled: boolean): Book {
  const keep = new Set(book.keepDuplicateTitleKeys ?? []);
  if (enabled) keep.delete(key); else keep.add(key);
  return { ...book, keepDuplicateTitleKeys: [...keep] };
}
