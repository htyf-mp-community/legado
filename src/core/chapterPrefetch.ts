import type { Book, LocalChapter } from '../types';
import { allSettledLimited } from './concurrency';
import { mergeSourceVariables } from './sourceVariables';

export type ChapterLoadResult = string | { content: string; variable?: string; bookVariable?: string };
export async function prefetchUpcomingChapters(
  book: Book,
  currentIndex: number,
  count: number,
  concurrency: number,
  load: (chapter: LocalChapter, index: number) => Promise<ChapterLoadResult>,
) {
  const chapters = [...(book.chapters ?? [])];
  const candidates = chapters
    .map((chapter, index) => ({ chapter, index }))
    .slice(Math.max(0, currentIndex + 1), Math.max(0, currentIndex + 1 + count))
    .filter(item => !!item.chapter.url && !item.chapter.content && !item.chapter.isVolume);
  if (!candidates.length) return book;
  const results = await allSettledLimited(
    candidates.map(item => () => load(item.chapter, item.index)),
    concurrency,
  );
  results.forEach((result, resultIndex) => {
    if (result.status !== 'fulfilled') return;
    const item = candidates[resultIndex];
    const value = result.value;
    chapters[item.index] = typeof value === 'string'
      ? { ...item.chapter, content: value }
      : { ...item.chapter, content: value.content, ...(value.variable !== undefined ? {variable: value.variable} : {}) };
  });
  const bookVariable = mergeSourceVariables(book.variable, book.variable, results.map(result =>
    result.status === 'fulfilled' && typeof result.value !== 'string' ? result.value.bookVariable : undefined));
  return results.some(result => result.status === 'fulfilled')
    ? { ...book, ...(bookVariable !== book.variable ? {variable: bookVariable} : {}), chapters, updatedAt: Date.now() }
    : book;
}
