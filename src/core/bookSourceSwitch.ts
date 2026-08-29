import type { Book, BookSource, SearchBook } from '../types';
import { switchLibraryBookSource } from './onlineLibrary';
import { loadBookInfo, loadChapterContent, loadChapters, searchSource } from './webBook';

export type SourceSwitchErrorCode = 'sourceSwitchSourceRemoved' | 'sourceSwitchEmptyToc';
export class SourceSwitchError extends Error {
  constructor(readonly code: SourceSwitchErrorCode) { super(code); }
}

const comparable = (value: string) => value.trim().toLocaleLowerCase();
export function isSourceSwitchMatch(bookName: string, candidateName: string) {
  const book = comparable(bookName), candidate = comparable(candidateName);
  return !!book && !!candidate && (book === candidate || book.includes(candidate) || candidate.includes(book));
}

export async function discoverSourceSwitchCandidates(
  book: Book,
  sources: BookSource[],
  search: (source: BookSource, keyword: string) => Promise<SearchBook[]> = searchSource,
) {
  const settled = await Promise.allSettled(sources.filter(source => source.enabled && source.searchUrl).map(source => search(source, book.name)));
  const seen = new Set<string>(), candidates: SearchBook[] = [];
  for (const result of settled) {
    if (result.status !== 'fulfilled') continue;
    for (const candidate of result.value) {
      const key = `${candidate.origin}\n${candidate.bookUrl}`;
      if (candidate.bookUrl !== book.bookUrl && isSourceSwitchMatch(book.name, candidate.name) && !seen.has(key)) {
        seen.add(key);
        candidates.push(candidate);
      }
    }
  }
  return { candidates, failedSources: settled.filter(result => result.status === 'rejected').length };
}

export async function applySourceSwitchCandidate(book: Book, candidate: SearchBook, sources: BookSource[], loadInfo: typeof loadBookInfo = loadBookInfo, loadToc: typeof loadChapters = loadChapters) {
  const source = sources.find(item => item.bookSourceUrl === candidate.origin);
  if (!source) throw new SourceSwitchError('sourceSwitchSourceRemoved');
  const info = await loadInfo(source, candidate), chapters = await loadToc(source, info);
  if (!chapters.length) throw new SourceSwitchError('sourceSwitchEmptyToc');
  return switchLibraryBookSource(book, info, chapters);
}

export async function autoSwitchSourceForChapter(
  book: Book,
  chapterIndex: number,
  sources: BookSource[],
  discover: typeof discoverSourceSwitchCandidates = discoverSourceSwitchCandidates,
  apply: typeof applySourceSwitchCandidate = applySourceSwitchCandidate,
  loadContent: typeof loadChapterContent = loadChapterContent,
) {
  const currentChapter = book.chapters?.[chapterIndex];
  if (!currentChapter) throw new SourceSwitchError('sourceSwitchEmptyToc');
  const current = {
    ...book,
    currentChapterIndex: chapterIndex,
    chapterTitle: currentChapter.title,
    progress: book.chapters?.length ? chapterIndex / book.chapters.length : book.progress,
  };
  const { candidates } = await discover(current, sources);
  let lastError: unknown;
  for (const candidate of candidates) {
    if (current.author.trim() && candidate.author.trim() && current.author.trim().toLocaleLowerCase() !== candidate.author.trim().toLocaleLowerCase()) continue;
    try {
      const switched = await apply(current, candidate, sources);
      const targetIndex = switched.currentChapterIndex ?? 0,
        chapter = switched.chapters?.[targetIndex],
        source = sources.find(item => item.bookSourceUrl === switched.origin);
      if (!chapter?.url || !source) throw new SourceSwitchError('sourceSwitchSourceRemoved');
      const content = await loadContent(source, {
        url: chapter.url,
        title: chapter.title,
        index: targetIndex,
        bookUrl: switched.bookUrl ?? '',
        baseUrl: chapter.baseUrl ?? switched.tocUrl ?? switched.bookUrl ?? '',
        isVolume: !!chapter.isVolume,
        isVip: !!chapter.isVip,
        isPay: !!chapter.isPay,
      });
      if (!content.trim()) throw new Error('empty chapter content');
      const chapters = switched.chapters?.map((item, index) => index === targetIndex ? { ...item, content } : item);
      return { ...switched, chapters, content, chapterTitle: chapter.title, updatedAt: Date.now() };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('no working source');
}
