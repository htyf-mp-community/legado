import { normalizeRssSource } from '../data/rss';
import type { RssArticle, RssSource } from '../types';

const protectedFields = ['sourceName','sourceUrl','sourceGroup','sourceIcon','sourceComment','customOrder','header','sortUrl','searchUrl','ruleArticles','ruleNextPage','ruleTitle','ruleLink','rulePubDate','ruleDescription','ruleImage','ruleContent','nextContentUrl','injectJs','loginUrl','loginUi','loginCheckJs','enabled','enabledCookieJar','loadWithBaseUrl','enableJs','singleUrl','articleStyle','type'] as const;
export type RssSourceEditorErrorCode = 'rssNameRequired' | 'rssUrlRequired' | 'rssAdvancedInvalid' | 'rssAdvancedObject';
export class RssSourceEditorError extends Error { constructor(readonly code: RssSourceEditorErrorCode) { super(code); } }

export function rssAdvancedFields(source: RssSource) {
  const copy: Record<string, unknown> = { ...source };
  protectedFields.forEach(key => delete copy[key]);
  return copy;
}

export function buildEditedRssSource(source: RssSource, advancedJson: string) {
  if (!source.sourceName.trim()) throw new RssSourceEditorError('rssNameRequired');
  if (!source.sourceUrl.trim()) throw new RssSourceEditorError('rssUrlRequired');
  let extra: unknown;
  try { extra = JSON.parse(advancedJson); } catch { throw new RssSourceEditorError('rssAdvancedInvalid'); }
  if (!extra || Array.isArray(extra) || typeof extra !== 'object') throw new RssSourceEditorError('rssAdvancedObject');
  return normalizeRssSource({ ...source, ...(extra as object), ...Object.fromEntries(protectedFields.map(key => [key, source[key]])) });
}

export function migrateRssArticleOrigin(articles: RssArticle[], previousUrl: string, nextUrl: string) {
  if (!previousUrl || previousUrl === nextUrl) return articles;
  const migrated = articles.map(article => article.origin === previousUrl ? { ...article, origin: nextUrl, id: article.id.startsWith(`${previousUrl}::`) ? `${nextUrl}::${article.id.slice(previousUrl.length + 2)}` : article.id } : article);
  return [...new Map(migrated.map(article => [article.id, article])).values()];
}
