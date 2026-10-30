import type { LocalChapter } from '../types';
import { compileSourceRegex } from './sourceRegex';
import { nativeTextOffset } from './readerPosition';
export type ContentMatch = {
  chapterIndex: number;
  chapterId: string;
  chapterTitle: string;
  start: number;
  end: number;
  excerpt: string;
  match: string;
  ordinal: number;
  queryIndexInResult: number;
  query: string;
  regex: boolean;
};
export type ContentSearchSession = { query: string; regex: boolean; results: ContentMatch[]; selected: number };
export type ContentSearchRequest = ContentSearchSession & { requestId: number };
export const trimContentSearchQuery = (value: string) => value.replace(/^[\t-\r\x1C-\x20\p{Zs}\u2028\u2029]+|[\t-\r\x1C-\x20\p{Zs}\u2028\u2029]+$/gu, '');

export function* contentSearchPositions(content: string, query: string, regex = false): Generator<{ start: number; end: number }> {
  if (!query) return;
  if (regex) {
    try {
      for (const match of content.matchAll(compileSourceRegex(query, 'u')))
        yield { start: match.index, end: match.index + match[0].length };
    } catch { return; }
  } else {
    for (let start = content.indexOf(query); start >= 0; start = content.indexOf(query, start + query.length))
      yield { start, end: start + query.length };
  }
}

export function contentSearchResult(
  content: string, query: string, regex: boolean, start: number, end: number,
  chapter: Pick<LocalChapter, 'id' | 'title'>, chapterIndex: number, ordinal: number,
): ContentMatch {
  const left = Math.max(0, start - 20), right = Math.min(content.length, start + query.length + 20);
  return { chapterIndex, chapterId: chapter.id, chapterTitle: chapter.title, start, end,
    excerpt: content.slice(left, right), match: content.slice(start, end), ordinal,
    queryIndexInResult: start - left, query, regex };
}

export function contentSearchSnippetParts(result: Pick<ContentMatch, 'excerpt' | 'query' | 'regex'>) {
  const { excerpt, query } = result;
  let start = -1, length = query.length;
  if (result.regex) {
    try {
      if (excerpt.length < 20) return { before: excerpt, match: '', after: '' };
      const expression = compileSourceRegex(query, 'u'); expression.lastIndex = 20;
      let match = expression.exec(excerpt);
      if (!match) { expression.lastIndex = 0; match = expression.exec(excerpt); }
      if (match) { start = match.index; length = match[0].length; }
    } catch { return { before: excerpt, match: '', after: '' }; }
  } else {
    start = excerpt.indexOf(query, 20);
    if (start < 0) start = excerpt.indexOf(query);
  }
  return start < 0 ? { before: excerpt, match: '', after: '' }
    : { before: excerpt.slice(0, start), match: excerpt.slice(start, start + length), after: excerpt.slice(start + length) };
}

/** Native reader re-finds the chapter's occurrence ordinal after opening its current layout. */
export function locateContentSearchResult(title: string, body: string, result: ContentMatch, indent: string, specialPageBreaks: boolean) {
  let ordinal = 0;
  for (const match of contentSearchPositions(`${title}\n${body}`, result.query, result.regex)) {
    if (ordinal++ !== result.ordinal) continue;
    if (match.start <= title.length) return 0;
    return nativeTextOffset(title, body, match.start - title.length - 1, indent, true, specialPageBreaks);
  }
  return 0;
}

export function searchChapters(
  chapters: LocalChapter[],
  query: string,
  limit = Infinity,
  regex = false,
): ContentMatch[] {
  const key = trimContentSearchQuery(query);
  if (!key) return [];
  const results: ContentMatch[] = [];
  for (let chapterIndex = 0; chapterIndex < chapters.length; chapterIndex++) {
    const chapter = chapters[chapterIndex];
    let ordinal = 0;
    for (const { start, end } of contentSearchPositions(chapter.content, key, regex)) {
      if (results.length >= limit) break;
      results.push(contentSearchResult(chapter.content, key, regex, start, end, chapter, chapterIndex, ordinal++));
    }
    if (results.length >= limit) break;
  }
  return results;
}
