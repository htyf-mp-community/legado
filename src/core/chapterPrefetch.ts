import type { Book, LocalChapter } from '../types';
import { allSettledLimited } from './concurrency';

export async function prefetchUpcomingChapters(
  book: Book,
  currentIndex: number,
  count: number,
  concurrency: number,
  load: (chapter: LocalChapter, index: number) => Promise<string>,
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
    chapters[item.index] = { ...item.chapter, content: result.value };
  });
  return results.some(result => result.status === 'fulfilled')
    ? { ...book, chapters, updatedAt: Date.now() }
    : book;
}
