import type { RssArticle, RssSource } from '../types';
import { appStorage } from './storage';

const SOURCES_KEY = 'rss.sources.v1';
const ARTICLES_KEY = 'rss.articles.v1';
export const DEFAULT_RSS_FAVORITE_GROUP = '默认分组';
const text = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

export type RssArticleView = 'all' | 'history' | 'favorites';

export function filterRssArticles(
  articles: RssArticle[],
  view: RssArticleView,
  sourceUrl = '',
  sort = '',
  favoriteGroup = '',
) {
  if (view === 'history')
    return articles
      .filter(article => article.read)
      .sort((a, b) => (b.readTime ?? 0) - (a.readTime ?? 0));
  if (view === 'favorites')
    return articles
      .filter(
        article =>
          article.starred &&
          (!favoriteGroup ||
            (article.favoriteGroup?.trim() || DEFAULT_RSS_FAVORITE_GROUP) ===
              favoriteGroup),
      )
      .sort((a, b) => (b.readTime ?? 0) - (a.readTime ?? 0));
  return articles.filter(
    article =>
      (!sourceUrl || article.origin === sourceUrl) &&
      (!sort || article.sort === sort),
  );
}

export function parseRssSources(input: string): RssSource[] {
  let raw: unknown;
  try {
    raw = JSON.parse(input);
  } catch {
    throw new Error('RSS 源不是有效的 JSON');
  }
  const list = Array.isArray(raw) ? raw : [raw];
  if (!list.length) throw new Error('RSS 源列表为空');
  return list.map(value => {
    if (!value || typeof value !== 'object')
      throw new Error('RSS 源条目必须是对象');
    const source = value as Record<string, unknown>;
    const sourceUrl = text(source.sourceUrl);
    const sourceName = text(source.sourceName);
    if (!sourceUrl || !sourceName) throw new Error('RSS 源缺少名称或地址');
    return normalizeRssSource({ ...source, sourceUrl, sourceName });
  });
}

export function normalizeRssSource(source: Record<string, unknown>): RssSource {
  const sourceUrl = text(source.sourceUrl),
    sourceName = text(source.sourceName);
  if (!sourceUrl || !sourceName) throw new Error('RSS 源缺少名称或地址');
  const result: Record<string, unknown> = { ...source, sourceUrl, sourceName };
  for (const key of [
    'sourceGroup',
    'sourceIcon',
    'sourceComment',
    'header',
    'loginUrl',
    'loginUi',
    'loginCheckJs',
    'sortUrl',
    'ruleArticles',
    'ruleNextPage',
    'ruleTitle',
    'rulePubDate',
    'ruleDescription',
    'ruleImage',
    'ruleLink',
    'ruleContent',
    'nextContentUrl',
    'style',
    'injectJs',
    'searchUrl',
  ]) {
    const value = text(source[key]);
    result[key] = value || undefined;
  }
  result.enabled = source.enabled !== false;
  result.customOrder = Number.isFinite(source.customOrder)
    ? Number(source.customOrder)
    : 0;
  result.articleStyle = Number.isFinite(source.articleStyle)
    ? Number(source.articleStyle)
    : 0;
  result.type = Number.isFinite(source.type) ? Number(source.type) : 0;
  result.singleUrl = source.singleUrl === true;
  result.enabledCookieJar = source.enabledCookieJar !== false;
  result.enableJs = source.enableJs !== false;
  result.loadWithBaseUrl = source.loadWithBaseUrl !== false;
  result.lastUpdateTime = Number.isFinite(source.lastUpdateTime)
    ? Number(source.lastUpdateTime)
    : Date.now();
  return result as RssSource;
}

export function exportRssSources(sources: RssSource[]) {
  return JSON.stringify(sources, null, 2);
}

export function mergeRssSources(current: RssSource[], incoming: RssSource[]) {
  const byUrl = new Map(current.map(source => [source.sourceUrl, source]));
  incoming.forEach(source =>
    byUrl.set(source.sourceUrl, { ...byUrl.get(source.sourceUrl), ...source }),
  );
  return [...byUrl.values()].sort(
    (a, b) =>
      b.customOrder - a.customOrder || a.sourceName.localeCompare(b.sourceName),
  );
}

export function loadRssSources(): RssSource[] {
  const raw = appStorage.getString(SOURCES_KEY);
  if (!raw) return [];
  try {
    return parseRssSources(raw);
  } catch {
    return [];
  }
}
export function saveRssSources(sources: RssSource[]) {
  appStorage.set(SOURCES_KEY, JSON.stringify(sources));
}
export function loadRssArticles(): RssArticle[] {
  const raw = appStorage.getString(ARTICLES_KEY);
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value)
      ? (value as RssArticle[]).map(article =>
          article.starred && !article.favoriteGroup
            ? { ...article, favoriteGroup: DEFAULT_RSS_FAVORITE_GROUP }
            : article,
        )
      : [];
  } catch {
    return [];
  }
}
export function saveRssArticles(articles: RssArticle[]) {
  appStorage.set(ARTICLES_KEY, JSON.stringify(articles));
}
export function mergeRssArticles(
  current: RssArticle[],
  incoming: RssArticle[],
) {
  const byId = new Map(current.map(article => [article.id, article]));
  incoming.forEach(article => {
    const previous = byId.get(article.id);
    byId.set(article.id, {
      ...previous,
      ...article,
      read: previous?.read ?? article.read,
      starred: previous?.starred ?? article.starred,
      favoriteGroup: previous?.favoriteGroup ?? article.favoriteGroup,
      readTime: previous?.readTime ?? article.readTime,
    });
  });
  return [...byId.values()].sort((a, b) =>
    (b.pubDate ?? '').localeCompare(a.pubDate ?? ''),
  );
}
export function updateRssArticle(
  articles: RssArticle[],
  id: string,
  update: Partial<RssArticle>,
) {
  return articles.map(article =>
    article.id === id ? { ...article, ...update } : article,
  );
}

export function rssFavoriteGroups(articles: RssArticle[]) {
  return [
    ...new Set(
      articles
        .filter(article => article.starred)
        .map(
          article =>
            article.favoriteGroup?.trim() || DEFAULT_RSS_FAVORITE_GROUP,
        ),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

export function setRssFavorite(
  articles: RssArticle[],
  id: string,
  starred: boolean,
  group = DEFAULT_RSS_FAVORITE_GROUP,
) {
  return updateRssArticle(articles, id, {
    starred,
    favoriteGroup: starred
      ? group.trim() || DEFAULT_RSS_FAVORITE_GROUP
      : undefined,
  });
}

export function deleteRssFavoriteGroup(articles: RssArticle[], group: string) {
  return articles.map(article =>
    article.starred &&
    (article.favoriteGroup?.trim() || DEFAULT_RSS_FAVORITE_GROUP) === group
      ? { ...article, starred: false, favoriteGroup: undefined }
      : article,
  );
}

export function clearRssFavorites(articles: RssArticle[]) {
  return articles.map(article =>
    article.starred
      ? { ...article, starred: false, favoriteGroup: undefined }
      : article,
  );
}
