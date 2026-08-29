import type { LocalChapter } from '../types';
export type ContentMatch = {
  chapterIndex: number;
  chapterId: string;
  chapterTitle: string;
  start: number;
  end: number;
  excerpt: string;
  match: string;
};
export function searchChapters(
  chapters: LocalChapter[],
  query: string,
  limit = 100,
): ContentMatch[] {
  const key = query.trim().toLocaleLowerCase();
  if (!key) return [];
  const results: ContentMatch[] = [];
  for (let chapterIndex = 0; chapterIndex < chapters.length; chapterIndex++) {
    const chapter = chapters[chapterIndex],
      haystack = chapter.content.toLocaleLowerCase();
    let from = 0;
    while (results.length < limit) {
      const start = haystack.indexOf(key, from);
      if (start < 0) break;
      const end = start + key.length,
        left = Math.max(0, start - 28),
        right = Math.min(chapter.content.length, end + 48);
      results.push({
        chapterIndex,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        start,
        end,
        excerpt: `${left ? '…' : ''}${chapter.content.slice(left, right)}${right < chapter.content.length ? '…' : ''}`,
        match: chapter.content.slice(start, end),
      });
      from = Math.max(end, start + 1);
    }
    if (results.length >= limit) break;
  }
  return results;
}
