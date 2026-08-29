import type { RssArticle, RssSource } from '../types';
import { buildSourceRequest } from './sourceRequest';
import {
  fetchRssFeedPage,
  parseRssContentPage,
  parseRssSortEntries,
} from './rss';
import type { BookSource } from '../types';

export type RssDebugStage =
  | 'input'
  | 'list-request'
  | 'list-response'
  | 'list-parse'
  | 'content-request'
  | 'content-response'
  | 'content-parse'
  | 'complete';

export type RssDebugEvent = {
  stage: RssDebugStage;
  status: 'running' | 'success' | 'error';
  message: string;
};

export type RssDebugResult = {
  events: RssDebugEvent[];
  listSource: string;
  contentSource: string;
  articles: RssArticle[];
  content: string;
  requestUrl: string;
};

const asBookSource = (source: RssSource): BookSource =>
  ({
    ...source,
    bookSourceUrl: source.sourceUrl,
    bookSourceName: source.sourceName,
    bookSourceType: 0,
    enabled: source.enabled,
    enabledExplore: false,
    customOrder: source.customOrder,
  }) as BookSource;

export function resolveRssDebugInput(source: RssSource, raw: string) {
  const input = raw.trim(),
    split = input.indexOf('::');
  if (split > 0)
    return {
      sortName: input.slice(0, split).trim() || source.sourceName,
      url: input.slice(split + 2).trim() || source.sourceUrl,
      key: '',
    };
  if (/^https?:\/\//i.test(input))
    return { sortName: source.sourceName, url: input, key: '' };
  if (input && source.searchUrl)
    return {
      sortName: input,
      url: String(source.searchUrl),
      key: input,
    };
  return {
    sortName: source.sourceName,
    url: source.sourceUrl,
    key: input,
  };
}

async function fetchRawContent(
  source: RssSource,
  article: RssArticle,
  fetcher: typeof fetch,
) {
  const request = buildSourceRequest(asBookSource(source), article.link),
    response = await fetcher(request.url, {
      method: request.method,
      headers: request.headers,
      body:
        request.method === 'GET' || request.method === 'HEAD'
          ? undefined
          : request.body,
    });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return { body: await response.text(), url: response.url || request.url };
}

export async function runRssSourceDebug(
  source: RssSource,
  input: string,
  report: (event: RssDebugEvent) => void = () => undefined,
  fetcher: typeof fetch = fetch,
): Promise<RssDebugResult> {
  const events: RssDebugEvent[] = [],
    emit = (event: RssDebugEvent) => {
      events.push(event);
      report(event);
    },
    resolved = resolveRssDebugInput(source, input),
    request = buildSourceRequest(
      asBookSource(source),
      resolved.url,
      resolved.key,
      1,
    );
  emit({
    stage: 'input',
    status: 'success',
    message: `${resolved.sortName} · ${resolved.key || 'URL'}`,
  });
  emit({ stage: 'list-request', status: 'running', message: request.url });
  try {
    const page = await fetchRssFeedPage(
      source,
      { ...resolved, page: 1 },
      fetcher,
    );
    emit({
      stage: 'list-response',
      status: 'success',
      message: `${page.responseUrl} · ${page.body.length} B`,
    });
    emit({
      stage: 'list-parse',
      status: page.articles.length ? 'success' : 'error',
      message: `${page.articles.length} articles${page.nextUrl ? ' · next page' : ''}`,
    });
    let contentSource = '',
      content = '';
    const first = page.articles[0];
    if (first) {
      emit({
        stage: 'content-request',
        status: 'running',
        message: first.link,
      });
      const response = await fetchRawContent(source, first, fetcher);
      contentSource = response.body;
      emit({
        stage: 'content-response',
        status: 'success',
        message: `${response.url} · ${response.body.length} B`,
      });
      content = source.ruleContent
        ? parseRssContentPage(response.body, response.url, source, true).content
        : first.content || first.description || '';
      emit({
        stage: 'content-parse',
        status: content ? 'success' : 'error',
        message: `${content.length} characters`,
      });
    }
    emit({ stage: 'complete', status: 'success', message: 'Debug complete' });
    return {
      events,
      listSource: page.body,
      contentSource,
      articles: page.articles,
      content,
      requestUrl: request.url,
    };
  } catch (error) {
    emit({
      stage: events.at(-1)?.stage ?? 'list-request',
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export function rssDebugSuggestions(source: RssSource) {
  const base = [
    { title: '我的', value: '我的' },
    { title: '系统', value: '系统' },
  ];
  try {
    return [
      ...base,
      ...parseRssSortEntries(source).map(item => ({
        title: item.title,
        value: `${item.title}::${item.url}`,
      })),
    ];
  } catch {
    return base;
  }
}
