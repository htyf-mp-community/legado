import type { BookSource } from '../types';
import {
  loadBookInfo,
  loadChapterContent,
  loadChapters,
  searchSource,
} from './webBook';

export type SourceDebugStage = 'search' | 'info' | 'toc' | 'content';
export type SourceDebugMessageKey = 'debugSearch' | 'debugInfo' | 'debugToc' | 'debugContent' | 'debugStageRunning' | 'debugStageFailed' | 'debugSearchSuccess' | 'debugInfoSuccess' | 'debugTocSuccess' | 'debugContentSuccess' | 'unknownAuthor';
export type SourceDebugPipelineErrorCode = 'debugNoSearchResult' | 'debugNoChapter';
export class SourceDebugPipelineError extends Error {
  constructor(readonly code: SourceDebugPipelineErrorCode) { super(code); }
}
export type SourceDebugEvent = {
  stage: SourceDebugStage;
  status: 'running' | 'success' | 'error';
  message: string;
};

type Format = (key: SourceDebugMessageKey, values?: Record<string, string | number>) => string;
const english: Record<SourceDebugMessageKey, string> = {
  debugSearch: 'Search', debugInfo: 'Details', debugToc: 'Contents', debugContent: 'Content', debugStageRunning: '{stage} running…', debugStageFailed: '{stage} failed: {error}', debugSearchSuccess: 'Search succeeded: {count} results', debugInfoSuccess: 'Details succeeded: {name} / {author}', debugTocSuccess: 'Contents succeeded: {count} chapters', debugContentSuccess: 'Content succeeded: {count} characters', unknownAuthor: 'Unknown author',
};
const defaultFormat: Format = (key, values = {}) => Object.entries(values).reduce((message, [name, value]) => message.replaceAll(`{${name}}`, String(value)), english[key]);

export async function runSourceDebug(
  source: BookSource,
  keyword: string,
  emit: (event: SourceDebugEvent) => void = () => undefined,
  format: Format = defaultFormat,
) {
  const run = async <T>(
    stage: SourceDebugStage,
    labelKey: Extract<SourceDebugMessageKey, 'debugSearch' | 'debugInfo' | 'debugToc' | 'debugContent'>,
    action: () => Promise<T>,
    summary: (value: T) => string,
  ) => {
    const label = format(labelKey);
    emit({ stage, status: 'running', message: format('debugStageRunning', { stage: label }) });
    try {
      const value = await action();
      emit({ stage, status: 'success', message: summary(value) });
      return value;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      emit({ stage, status: 'error', message: format('debugStageFailed', { stage: label, error: message }) });
      throw reason;
    }
  };
  const books = await run(
      'search',
      'debugSearch',
      () => searchSource(source, keyword),
      value => format('debugSearchSuccess', { count: value.length }),
    ),
    first = books[0];
  if (!first) throw new SourceDebugPipelineError('debugNoSearchResult');
  const info = await run(
      'info',
      'debugInfo',
      () => loadBookInfo(source, first),
      value => format('debugInfoSuccess', { name: value.name, author: value.author || format('unknownAuthor') }),
    ),
    chapters = await run(
      'toc',
      'debugToc',
      () => loadChapters(source, info),
      value => format('debugTocSuccess', { count: value.length }),
    ),
    chapter = chapters.find(item => !item.isVolume);
  if (!chapter) throw new SourceDebugPipelineError('debugNoChapter');
  const content = await run(
    'content',
    'debugContent',
    () => loadChapterContent(source, chapter),
    value => format('debugContentSuccess', { count: value.length }),
  );
  return { books, info, chapters, chapter, content };
}
