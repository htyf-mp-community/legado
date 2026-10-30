import type { Book, LocalChapter, ReplaceRule } from '../types';
import type { ReaderPreferences } from '../data/readerPreferences';
import { applyReplaceRules, replacementContextForBook } from '../data/replaceRules';
import { convertChinese, displayChapterTitle } from './chineseConversion';
import { chapterTitleRemovalKey } from './chapterTitlePolicy';
import { processChapterTitle } from './chapterTitle';
import { decodeReaderContent, protectNativeReaderHtml } from './readerNativeContent';
import { prepareReaderText } from './readerText';
import { runReaderContentRules } from './readerReplacement';
import { contentSearchPositions, contentSearchResult, trimContentSearchQuery, type ContentMatch } from './contentSearch';

export type SearchTextPreferences = Pick<ReaderPreferences, 'chineseConverterType' | 'adaptSpecialStyle' | 'paragraphIndent'>;
export function prepareContentSearchChapter(
  book: Book, chapter: LocalChapter, chapterIndex: number, preferences: SearchTextPreferences,
  rules: ReplaceRule[], replaceEnabled: boolean, random?: () => number,
) {
  // SearchContentViewModel converts the chapter's title before calling getContent.
  const title = convertChinese(chapter.title, preferences.chineseConverterType);
  const context = replacementContextForBook(book);
  const activeRules = replaceEnabled ? rules : [];
  const replaceTitle = (input: string) => applyReplaceRules(input, activeRules, 'title', context);
  const displayTitle = displayChapterTitle(title, preferences.chineseConverterType, replaceTitle);
  const native = decodeReaderContent(chapter.content, chapter.url ?? chapter.baseUrl ?? book.bookUrl ?? '');
  const removal = processChapterTitle(native.content, {
    title, bookName: book.name, displayTitle: displayChapterTitle(title, 0, replaceTitle),
    replaceEnabled, skipRemoval: book.keepDuplicateTitleKeys?.includes(chapterTitleRemovalKey(chapterIndex, title)),
  });
  const prepared = prepareReaderText(removal.content, title, book.reSegment === true, preferences.chineseConverterType, random);
  const protectedValue = protectNativeReaderHtml(prepared, preferences.adaptSpecialStyle);
  const replaced = runReaderContentRules(protectedValue.text, activeRules, context, replaceEnabled);
  const content = `${displayTitle}\n${protectedValue.restore(replaced.value)}`.split(/\r\n|[\r\n]/)
    .map(line => line.replace(/^[\x00-\x20\u3000]+|[\x00-\x20\u3000]+$/g, '')).filter(Boolean)
    .map((line, index) => index === 0 ? line : preferences.paragraphIndent + line).join('\n');
  return { title, content };
}

/** Search only available chapter caches; publish a chapter atomically and yield during large scans. */
export async function runBookContentSearch({
  book, chapters, query, regex, preferences, rules, replaceEnabled, signal, onChapter,
  yieldTask = () => new Promise<void>(resolve => setTimeout(resolve, 0)),
}: {
  book: Book; chapters: LocalChapter[]; query: string; regex: boolean; preferences: SearchTextPreferences;
  rules: ReplaceRule[]; replaceEnabled: boolean; signal: AbortSignal;
  onChapter: (results: ContentMatch[], chapterIndex: number) => void;
  yieldTask?: () => Promise<void>;
}) {
  const key = trimContentSearchQuery(query);
  if (!key) return;
  for (let chapterIndex = 0; chapterIndex < chapters.length; chapterIndex++) {
    if (signal.aborted) return;
    const chapter = chapters[chapterIndex];
    if (!chapter.content) continue;
    const prepared = prepareContentSearchChapter(book, chapter, chapterIndex, preferences, rules, replaceEnabled);
    const results: ContentMatch[] = [];
    for (const { start, end } of contentSearchPositions(prepared.content, key, regex)) {
      if (signal.aborted) return;
      results.push(contentSearchResult(prepared.content, key, regex, start, end,
        { id: chapter.id, title: prepared.title }, chapterIndex, results.length));
      if (results.length % 256 === 0) { await yieldTask(); if (signal.aborted) return; }
    }
    onChapter(results, chapterIndex);
    await yieldTask();
  }
}
