import type { Book, BookSource, SearchBook } from '../types';
import { switchLibraryBookSource } from './onlineLibrary';
import { loadBookInfo, loadChapterContent, loadChapters, searchSource } from './webBook';
import { addAppLog } from '../data/appLog';

export type SourceSwitchErrorCode = 'sourceSwitchSourceRemoved' | 'sourceSwitchEmptyToc';
export class SourceSwitchError extends Error {
  constructor(readonly code: SourceSwitchErrorCode) { super(code); }
}

const comparable = (value: string) => value.trim().toLocaleLowerCase();
const comparableAuthor = (value: string) =>
  value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase()
    .replace(/^\s*(?:作者|作者名)\s*[:：]?\s*/, '')
    .replace(/\s*(?:著|著作)\s*$/, '')
    .replace(/[\s\p{P}\p{S}]+/gu, '');

function authorsMatch(currentAuthor: string, candidateAuthor: string) {
  const current = comparableAuthor(currentAuthor),
    candidate = comparableAuthor(candidateAuthor);
  return (
    !current ||
    !candidate ||
    current === candidate ||
    current.includes(candidate) ||
    candidate.includes(current)
  );
}
export function isSourceSwitchMatch(bookName: string, candidateName: string) {
  const book = comparable(bookName), candidate = comparable(candidateName);
  return !!book && !!candidate && (book === candidate || book.includes(candidate) || candidate.includes(book));
}

export async function discoverSourceSwitchCandidates(
  book: Book,
  sources: BookSource[],
  search: (source: BookSource, keyword: string) => Promise<SearchBook[]> = searchSource,
) {
  const eligible = sources.filter(source => source.enabled && source.searchUrl);
  addAppLog(`[source-switch] search start book=${JSON.stringify(book.name)} origin=${book.origin ?? ''} sources=${eligible.length}`);
  const settled = await Promise.allSettled(eligible.map(source => search(source, book.name)));
  const seen = new Set<string>(), candidates: SearchBook[] = [];
  for (let resultIndex = 0; resultIndex < settled.length; resultIndex += 1) {
    const result = settled[resultIndex], source = eligible[resultIndex];
    if (result.status !== 'fulfilled') {
      addAppLog(`[source-switch] search failed source=${source.bookSourceName} origin=${source.bookSourceUrl}`, result.reason);
      continue;
    }
    addAppLog(`[source-switch] search result source=${source.bookSourceName} count=${result.value.length}`);
    for (const candidate of result.value) {
      const key = `${candidate.origin}\n${candidate.bookUrl}`;
      const isCurrentSourceBook =
        candidate.origin === book.origin && candidate.bookUrl === book.bookUrl;
      const titleMatches = isSourceSwitchMatch(book.name, candidate.name),
        duplicate = seen.has(key);
      addAppLog(`[source-switch] candidate source=${candidate.originName} name=${JSON.stringify(candidate.name)} author=${JSON.stringify(candidate.author)} url=${candidate.bookUrl} current=${isCurrentSourceBook} titleMatch=${titleMatches} duplicate=${duplicate}`);
      if (!isCurrentSourceBook && titleMatches && !duplicate) {
        seen.add(key);
        candidates.push(candidate);
      }
    }
  }
  addAppLog(`[source-switch] search complete candidates=${candidates.length} failedSources=${settled.filter(result => result.status === 'rejected').length}`);
  return { candidates, failedSources: settled.filter(result => result.status === 'rejected').length };
}

export async function applySourceSwitchCandidate(book: Book, candidate: SearchBook, sources: BookSource[], loadInfo: typeof loadBookInfo = loadBookInfo, loadToc: typeof loadChapters = loadChapters) {
  const source = sources.find(item => item.bookSourceUrl === candidate.origin);
  if (!source) throw new SourceSwitchError('sourceSwitchSourceRemoved');
  addAppLog(`[source-switch] candidate load start source=${source.bookSourceName} bookUrl=${candidate.bookUrl}`);
  const info = await loadInfo(source, candidate), chapters = await loadToc(source, info);
  addAppLog(`[source-switch] candidate load complete source=${source.bookSourceName} resolvedBookUrl=${info.bookUrl} tocUrl=${info.tocUrl ?? ''} chapters=${chapters.length}`);
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
    const authorMatches = authorsMatch(current.author, candidate.author);
    addAppLog(`[source-switch] candidate evaluate source=${candidate.originName} currentAuthor=${JSON.stringify(current.author)} candidateAuthor=${JSON.stringify(candidate.author)} authorMatch=${authorMatches}`);
    if (!authorMatches) continue;
    try {
      const switched = await apply(current, candidate, sources);
      const targetIndex = switched.currentChapterIndex ?? 0,
        chapter = switched.chapters?.[targetIndex],
        source = sources.find(item => item.bookSourceUrl === switched.origin);
      addAppLog(`[source-switch] chapter selected source=${switched.originName ?? switched.origin ?? ''} requestedIndex=${chapterIndex} targetIndex=${targetIndex} requestedTitle=${JSON.stringify(currentChapter.title)} targetTitle=${JSON.stringify(chapter?.title ?? '')} url=${chapter?.url ?? ''}`);
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
      addAppLog(`[source-switch] content success source=${source.bookSourceName} index=${targetIndex} chars=${content.length} url=${chapter.url}`);
      const chapters = switched.chapters?.map((item, index) => index === targetIndex ? { ...item, content } : item);
      return { ...switched, chapters, content, chapterTitle: chapter.title, updatedAt: Date.now() };
    } catch (error) {
      lastError = error;
      addAppLog(`[source-switch] candidate failed source=${candidate.originName} url=${candidate.bookUrl}`, error);
    }
  }
  addAppLog(`[source-switch] exhausted book=${JSON.stringify(book.name)} chapter=${JSON.stringify(currentChapter.title)} candidates=${candidates.length}`, lastError ?? new Error('no candidate passed filters'));
  throw lastError instanceof Error ? lastError : new Error('no working source');
}
