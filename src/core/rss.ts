import type { RssArticle, RssSource } from '../types';
import { SourceRuleError } from './errors';
import { sourceRuleText, sourceRuleValues } from './sourceRule';
import { buildSourceRequest, buildSourcePageRequest } from './sourceRequest';
import type { BookSource } from '../types';
import { resolveNativeSourceUrl } from './nativeSourceUrl';

const decode = (value: string) =>
  value
    .replace(/^<!\[CDATA\[|\]\]>$/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim();
const tag = (block: string, names: string[]) => {
  for (const name of names) {
    const match = block.match(
      new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'),
    );
    if (match) return decode(match[1]);
  }
  return '';
};
const attribute = (block: string, element: string, name: string) => {
  const match = block.match(
    new RegExp(`<${element}[^>]*\\s${name}=["']([^"']+)["'][^>]*>`, 'i'),
  );
  return match ? decode(match[1]) : '';
};
const absolute = resolveNativeSourceUrl;
const imageFrom = (value: string) =>
  value.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];

export function parseRssFeed(xml: string, source: RssSource): RssArticle[] {
  if (typeof source.ruleArticles === 'string' && source.ruleArticles.trim())
    return parseRssByRules(xml, source);
  const rssItems = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)];
  const atomItems = [
    ...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi),
  ];
  const items = rssItems.length ? rssItems : atomItems;
  return items
    .map(match => {
      const block = match[1];
      const title = tag(block, ['title']);
      const rawLink =
        tag(block, ['link', 'guid']) || attribute(block, 'link', 'href');
      const link = absolute(rawLink, source.sourceUrl);
      const description = tag(block, ['description', 'summary']);
      const content = tag(block, ['content:encoded', 'content']);
      const image =
        attribute(block, 'media:thumbnail', 'url') ||
        attribute(block, 'enclosure', 'url') ||
        imageFrom(content || description);
      return {
        id: `${source.sourceUrl}::${link || title}`,
        origin: source.sourceUrl,
        sort: source.sourceName,
        title,
        link,
        pubDate:
          tag(block, ['pubDate', 'published', 'updated', 'time']) || undefined,
        description: description || undefined,
        content: content || undefined,
        image: image ? absolute(image, source.sourceUrl) : undefined,
        read: false,
        starred: false,
      } satisfies RssArticle;
    })
    .filter(article => !!article.title && !!article.link);
}

export function parseRssByRules(
  body: string,
  source: RssSource,
  baseUrl = source.sourceUrl,
  sortName = source.sourceName,
): RssArticle[] {
  let value: unknown = body;
  try {
    value = JSON.parse(body);
  } catch {
    // HTML/XML rules consume the original text.
  }
  const rawRule = String(source.ruleArticles ?? '').trim();
  const reverse = rawRule.startsWith('-');
  const items = sourceRuleValues(value, reverse ? rawRule.slice(1) : rawRule);
  const articles = items
    .map((item, index) => {
      const title = sourceRuleText(item, source.ruleTitle);
      const rawLink = sourceRuleText(item, source.ruleLink, true);
      const link = absolute(rawLink, baseUrl);
      const description = sourceRuleText(item, source.ruleDescription);
      const image = sourceRuleText(item, source.ruleImage, true);
      return {
        id: `${source.sourceUrl}::${link || title || index}`,
        origin: source.sourceUrl,
        sort: sortName,
        title,
        link,
        pubDate: sourceRuleText(item, source.rulePubDate) || undefined,
        description: description || undefined,
        image: image ? absolute(image, baseUrl) : undefined,
        read: false,
        starred: false,
      } satisfies RssArticle;
    })
    .filter(article => article.title && article.link);
  return reverse ? articles.reverse() : articles;
}

export type RssSortEntry = { title: string; url: string };
export function parseRssSortEntries(source: RssSource): RssSortEntry[] {
  const value = typeof source.sortUrl === 'string' ? source.sortUrl.trim() : '';
  if (!value) return [{ title: source.sourceName, url: source.sourceUrl }];
  if (value.startsWith('{') || value.startsWith('[')) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed))
        return parsed
          .map(item =>
            item && typeof item === 'object'
              ? {
                  title: String(
                    (item as Record<string, unknown>).title ??
                      (item as Record<string, unknown>).name ??
                      '',
                  ).trim(),
                  url: String(
                    (item as Record<string, unknown>).url ?? '',
                  ).trim(),
                }
              : { title: '', url: '' },
          )
          .filter(item => item.title && item.url);
      if (parsed && typeof parsed === 'object')
        return Object.entries(parsed as Record<string, unknown>)
          .map(([title, url]) => ({
            title: title.trim(),
            url: String(url).trim(),
          }))
          .filter(item => item.title && item.url);
    } catch {
      throw new SourceRuleError('RSS 分类 URL JSON 无效', source.sourceName);
    }
  }
  const entries = value
    .split(/\r?\n|&&/)
    .map((line, index) => {
      const separator = line.indexOf('::');
      return separator < 0
        ? {
            title: index ? `RSS ${index + 1}` : source.sourceName,
            url: line.trim(),
          }
        : {
            title: line.slice(0, separator).trim(),
            url: line.slice(separator + 2).trim(),
          };
    })
    .filter(item => item.title && item.url);
  return entries.length
    ? entries
    : [{ title: source.sourceName, url: source.sourceUrl }];
}

export async function fetchRssFeedPage(
  source: RssSource,
  options: {
    sortName?: string;
    url?: string;
    page?: number;
    key?: string;
  } = {},
  fetcher: typeof fetch = fetch,
) {
  const sortName = options.sortName || source.sourceName,
    url = options.url || source.sourceUrl,
    page = options.page ?? 1;
  const definition = {
      ...source,
      bookSourceUrl: source.sourceUrl,
      bookSourceName: source.sourceName,
      bookSourceType: 0,
      enabledExplore: false,
    } as BookSource;
  const request = options.key === undefined
    ? buildSourcePageRequest(definition, url, page)
    : buildSourceRequest(definition, url, options.key, page);
  const response = await fetcher(request.url, {
    method: request.method,
    headers: {
      Accept:
        'application/rss+xml, application/atom+xml, text/xml, text/html, application/json',
      ...request.headers,
    },
    body:
      request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : request.body,
  });
  if (!response.ok)
    throw new SourceRuleError(`HTTP ${response.status}`, source.sourceName);
  const body = await response.text(),
    responseUrl = response.url || request.url;
  const articles =
    typeof source.ruleArticles === 'string' && source.ruleArticles.trim()
      ? parseRssByRules(body, source, responseUrl, sortName)
      : parseRssFeed(body, { ...source, sourceName: sortName });
  let ruleData: unknown = body;
  try {
    ruleData = JSON.parse(body);
  } catch {
    /* HTML/XML rules consume text. */
  }
  let nextUrl = '';
  const nextRule =
      typeof source.ruleNextPage === 'string' ? source.ruleNextPage.trim() : '',
    articleRule =
      typeof source.ruleArticles === 'string' ? source.ruleArticles.trim() : '';
  if (nextRule && articleRule) {
    const next = sourceRuleText(ruleData, nextRule, true);
    nextUrl =
      nextRule.toUpperCase() === 'PAGE'
        ? url
        : next
          ? absolute(next, responseUrl)
          : '';
  }
  return { articles, nextUrl, body, responseUrl };
}

export async function fetchRssFeed(source: RssSource): Promise<RssArticle[]> {
  return (await fetchRssFeedPage(source)).articles;
}

export function parseRssContentPage(
  body: string,
  baseUrl: string,
  source: RssSource,
  getNext = true,
) {
  let value: unknown = body;
  try {
    value = JSON.parse(body);
  } catch {
    /* HTML */
  }
  const content = sourceRuleText(value, String(source.ruleContent ?? ''));
  const nextValues =
    getNext && source.type !== 1 && source.nextContentUrl
      ? sourceRuleValues(value, String(source.nextContentUrl))
      : [];
  const next = nextValues
    .flatMap(item => (Array.isArray(item) ? item : [item]))
    .map(item =>
      absolute(typeof item === 'string' ? item : String(item), baseUrl),
    )
    .filter(Boolean);
  return { content, next };
}

async function fetchText(
  url: string,
  source: RssSource,
  fetcher: typeof fetch,
) {
  const request = buildSourcePageRequest(
    {
      ...source,
      bookSourceUrl: source.sourceUrl,
      bookSourceName: source.sourceName,
      bookSourceType: 0,
      enabledExplore: false,
    } as BookSource,
    url,
  );
  const response = await fetcher(request.url, {
    method: request.method,
    headers: request.headers,
    body:
      request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : request.body,
  });
  if (!response.ok)
    throw new SourceRuleError(`HTTP ${response.status}`, source.sourceName);
  return { body: await response.text(), url: response.url || request.url };
}

export async function fetchRssArticleContent(
  article: RssArticle,
  source: RssSource,
  fetcher: typeof fetch = fetch,
  concurrency = 4,
) {
  if (!source.ruleContent) return article.content || article.description || '';
  const first = await fetchText(article.link, source, fetcher),
    parsed = parseRssContentPage(first.body, first.url, source, true),
    contents = [parsed.content];
  if (parsed.next.length === 1) {
    const visited = new Set([first.url]);
    let next = parsed.next[0];
    while (next && !visited.has(next)) {
      visited.add(next);
      const response = await fetchText(next, source, fetcher),
        page = parseRssContentPage(response.body, response.url, source, true);
      contents.push(page.content);
      next = page.next[0] ?? '';
    }
  } else if (parsed.next.length > 1) {
    const limit = Math.max(1, Math.floor(concurrency));
    for (let index = 0; index < parsed.next.length; index += limit) {
      const batch = parsed.next.slice(index, index + limit);
      const pages = await Promise.all(
        batch.map(async url => {
          const response = await fetchText(url, source, fetcher);
          return parseRssContentPage(response.body, response.url, source, false)
            .content;
        }),
      );
      contents.push(...pages);
    }
  }
  return contents.filter(Boolean).join('\n');
}
