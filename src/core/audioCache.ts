import type { Book, LocalChapter } from '../types';
import type { ChapterLoadResult } from './chapterPrefetch';

export async function prepareAudioCacheRange(
  book: Book, start: number, end: number,
  load: (chapter: LocalChapter, index: number, bookVariable?: string) => Promise<ChapterLoadResult>,
): Promise<{book: Book; entries: Array<{chapter: LocalChapter; index: number; content: string}>}> {
  const chapters = [...(book.chapters ?? [])];
  const entries: Array<{chapter: LocalChapter; index: number; content: string}> = [];
  let bookVariable = book.variable, changed = false;
  for (let index = start; index <= end; index += 1) {
    const chapter = chapters[index];
    if (!chapter) continue;
    let content = chapter.content;
    if (!content && chapter.url) {
      const result = await load(chapter, index, bookVariable);
      content = typeof result === 'string' ? result : result.content;
      if (typeof result !== 'string') {
        if (result.variable !== undefined && result.variable !== chapter.variable) {
          chapters[index] = {...chapter, variable:result.variable};
          changed = true;
        }
        if (result.bookVariable !== undefined && result.bookVariable !== bookVariable) {
          bookVariable = result.bookVariable;
          changed = true;
        }
      }
    }
    entries.push({chapter: chapters[index], index, content});
  }
  return {book: changed ? {...book, chapters, variable: bookVariable} : book, entries};
}
