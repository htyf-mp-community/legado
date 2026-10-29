import type { BookChapter, BookSource, SearchBook } from '../types';
import { SourceRuleError, UnsupportedRuleError } from './errors';
import { buildSourceRequest, executeSourceRequest } from './sourceRequest';
import {
  sourceRuleText,
  sourceRuleTexts,
  sourceRuleValues,
} from './sourceRule';
import { readerHtmlToText } from './readerImages';
import { checkCancelled } from './cancellation';
const rule = (
  source: BookSource,
  name:
    | 'ruleSearch'
    | 'ruleExplore'
    | 'ruleBookInfo'
    | 'ruleToc'
    | 'ruleContent',
) => (source[name] ?? {}) as Record<string, unknown>;
export const resolveWebBookUrl = (value: string, base: string) => {
  const target = value.trim();
  if (/^\/\//.test(target)) {
    const protocol = base.match(/^([a-z][a-z\d+.-]*:)/i)?.[1] ?? 'https:';
    return `${protocol}${target}`;
  }
  if (/^\/(?!\/)/.test(target)) {
    const origin = base.match(/^([a-z][a-z\d+.-]*:\/\/[^/]+)/i)?.[1];
    if (origin) return `${origin}${target}`;
  }
  try {
    return new URL(target, base).toString();
  } catch {
    return target;
  }
};
const url = resolveWebBookUrl;
const optionalUrl = (value: string, base: string) =>
  value ? url(value, base) : undefined;
const optionalRuleText = (value: unknown, ruleValue: unknown) => {
  try {
    return sourceRuleText(value, ruleValue);
  } catch (error) {
    if (error instanceof UnsupportedRuleError) return '';
    throw error;
  }
};
const unescapeLiteral = (value: string) =>
  value.replace(/\\([\\'"nrtt])/g, (_match, escaped: string) =>
    escaped === 'n'
      ? '\n'
      : escaped === 'r'
        ? '\r'
        : escaped === 't'
          ? '\t'
          : escaped,
  );
export function resolveBookInfoTocUrl(
  ruleValue: unknown,
  parsedValue: string,
  baseUrl: string,
) {
  if (parsedValue) return parsedValue;
  if (typeof ruleValue !== 'string') return '';
  const compact = ruleValue.trim(),
    prefix = '@js:baseUrl';
  if (!compact.startsWith(prefix)) return '';
  const expression = compact.slice(prefix.length).replace(/;\s*$/, '');
  let cursor = 0,
    result = baseUrl;
  const replace = /\.replace\(\s*(['"])(.*?)\1\s*,\s*(['"])(.*?)\3\s*\)/g;
  for (
    let match = replace.exec(expression);
    match;
    match = replace.exec(expression)
  ) {
    if (match.index !== cursor) return '';
    result = result.replace(
      unescapeLiteral(match[2]),
      unescapeLiteral(match[4]),
    );
    cursor = replace.lastIndex;
  }
  return cursor === expression.length && cursor > 0 ? result : '';
}
export function parseSearchBooks(
  source: BookSource,
  data: unknown,
  baseUrl: string,
): SearchBook[] {
  const r = rule(source, 'ruleSearch'),
    items = sourceRuleValues(data, String(r.bookList ?? '$[*]')),
    seen = new Set<string>();
  return items
    .map(item => {
      const name = sourceRuleText(item, r.name),
        bookUrl = url(sourceRuleText(item, r.bookUrl) || baseUrl, baseUrl);
      const intro = optionalRuleText(item, r.intro);
      return {
        bookUrl,
        origin: source.bookSourceUrl,
        originName: source.bookSourceName,
        sourceType: source.bookSourceType,
        name,
        author: optionalRuleText(item, r.author),
        kind: optionalRuleText(item, r.kind) || undefined,
        coverUrl: optionalUrl(optionalRuleText(item, r.coverUrl), baseUrl),
        intro: intro ? readerHtmlToText(intro, baseUrl) : undefined,
        wordCount: optionalRuleText(item, r.wordCount) || undefined,
        latestChapterTitle: optionalRuleText(item, r.lastChapter) || undefined,
      };
    })
    .filter(
      book =>
        !!book.name && !seen.has(book.bookUrl) && !!seen.add(book.bookUrl),
    );
}
export async function searchSource(
  source: BookSource,
  key: string,
  page = 1,
  signal?: AbortSignal,
) {
  checkCancelled(signal);
  if (!source.enabled) return [];
  if (!source.searchUrl)
    throw new SourceRuleError('搜索 URL 为空', source.bookSourceName);
  const request = buildSourceRequest(source, source.searchUrl, key, page),
    response = await executeSourceRequest(request, 15000, signal);
  const books = parseSearchBooks(source, response.data, response.url);
  if (
    !books.length &&
    source.enabledCookieJar &&
    typeof response.data === 'string' &&
    response.data.includes('var buid')
  )
    throw new SourceRuleError(
      '网站要求 Cookie 验证，请在书源管理中打开“登录”，完成验证后重试',
      source.bookSourceName,
    );
  return books;
}
export type ExploreEntry = { title: string; url: string };
export function parseExploreEntries(source: BookSource): ExploreEntry[] {
  const value = source.exploreUrl?.trim();
  if (!value) return [];
  if (value.startsWith('[')) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed))
        return parsed
          .map(item => {
            if (!item || typeof item !== 'object') return null;
            const entry = item as Record<string, unknown>;
            const title = String(entry.title ?? entry.name ?? '').trim();
            const entryUrl = String(entry.url ?? '').trim();
            return title && entryUrl ? { title, url: entryUrl } : null;
          })
          .filter((item): item is ExploreEntry => item !== null);
    } catch {
      throw new SourceRuleError('发现 URL JSON 无效', source.bookSourceName);
    }
  }
  return value
    .split(/\r?\n|&&/)
    .map((line, index) => {
      const separator = line.indexOf('::');
      return separator < 0
        ? {
            title: index ? `发现 ${index + 1}` : source.bookSourceName,
            url: line.trim(),
          }
        : {
            title: line.slice(0, separator).trim(),
            url: line.slice(separator + 2).trim(),
          };
    })
    .filter(entry => !!entry.title && !!entry.url);
}
export function parseExploreBooks(
  source: BookSource,
  data: unknown,
  baseUrl: string,
): SearchBook[] {
  return parseSearchBooks(
    { ...source, ruleSearch: rule(source, 'ruleExplore') },
    data,
    baseUrl,
  );
}
export async function exploreSource(
  source: BookSource,
  entry: ExploreEntry,
  page = 1,
) {
  if (!source.enabled || !source.enabledExplore) return [];
  const response = await executeSourceRequest(
    buildSourceRequest(source, entry.url, '', page),
  );
  return parseExploreBooks(source, response.data, response.url);
}
export async function loadBookInfo(
  source: BookSource,
  book: SearchBook,
  signal?: AbortSignal,
): Promise<SearchBook> {
  checkCancelled(signal);
  const response = await executeSourceRequest(
    buildSourceRequest(source, book.bookUrl),
    15000,
    signal,
  );
  const r = rule(source, 'ruleBookInfo'),
    initialized = r.init
      ? (sourceRuleValues(response.data, String(r.init))[0] ?? response.data)
      : response.data;
  const intro = sourceRuleText(initialized, r.intro);
  const canRename = String(r.canReName ?? '').trim().length > 0;
  return {
    ...book,
    name:
      book.name && !canRename
        ? book.name
        : sourceRuleText(initialized, r.name) || book.name,
    author:
      book.author && !canRename
        ? book.author
        : sourceRuleText(initialized, r.author) || book.author,
    kind: sourceRuleText(initialized, r.kind) || book.kind,
    wordCount: sourceRuleText(initialized, r.wordCount) || book.wordCount,
    intro: intro ? readerHtmlToText(intro, response.url) : book.intro,
    coverUrl:
      optionalUrl(sourceRuleText(initialized, r.coverUrl), response.url) ||
      book.coverUrl,
    tocUrl: url(
      resolveBookInfoTocUrl(
        r.tocUrl,
        optionalRuleText(initialized, r.tocUrl),
        response.url,
      ) || book.bookUrl,
      response.url,
    ),
    latestChapterTitle:
      sourceRuleText(initialized, r.lastChapter) || book.latestChapterTitle,
  };
}
export function parseChapters(
  source: BookSource,
  book: SearchBook,
  data: unknown,
  baseUrl: string,
): BookChapter[] {
  const r = rule(source, 'ruleToc'),
    items = sourceRuleValues(data, String(r.chapterList ?? '$[*]'));
  return items
    .map((item, index) => {
      let chapterUrl =
        typeof r.chapterUrl === 'string' &&
        (r.chapterUrl.includes('@js:') || r.chapterUrl.includes('<js>'))
          ? ''
          : sourceRuleText(item, r.chapterUrl);
      if (
        !chapterUrl &&
        typeof r.chapterUrl === 'string' &&
        r.chapterUrl.includes('baseUrl.match(/\\d+/)') &&
        r.chapterUrl.includes("'https://vipreader.qidian.com/chapter/'")
      ) {
        const bid = (book.bookUrl.match(/\d+/) ?? baseUrl.match(/\d+/))?.[0],
          chapterId = sourceRuleText(item, '$3');
        if (bid && chapterId)
          chapterUrl = `https://vipreader.qidian.com/chapter/${bid}/${chapterId}/`;
      }
      return {
        url: url(chapterUrl, baseUrl),
        title: sourceRuleText(item, r.chapterName),
        index,
        bookUrl: book.bookUrl,
        baseUrl,
        isVolume: sourceRuleText(item, r.isVolume) === 'true',
        isVip: sourceRuleText(item, r.isVip) === 'true',
        isPay: sourceRuleText(item, r.isPay) === 'true',
        tag: optionalRuleText(item, r.updateTime) || undefined,
        wordCount: optionalRuleText(item, r.wordCount) || undefined,
      };
    })
    .filter(x => !!x.title);
}
export async function loadChapters(
  source: BookSource,
  book: SearchBook,
  signal?: AbortSignal,
) {
  checkCancelled(signal);
  const r = rule(source, 'ruleToc'),
    seenPages = new Set<string>(),
    seenChapters = new Set<string>(),
    chapters: BookChapter[] = [];
  let pageUrl = book.tocUrl || book.bookUrl;
  for (
    let page = 1;
    page <= 50 && pageUrl && !seenPages.has(pageUrl);
    page += 1
  ) {
    checkCancelled(signal);
    seenPages.add(pageUrl);
    const response = await executeSourceRequest(
      buildSourceRequest(source, pageUrl, '', page),
      15000,
      signal,
    );
    for (const chapter of parseChapters(
      source,
      book,
      response.data,
      response.url,
    )) {
      const key = chapter.url || `${chapter.title}:${chapters.length}`;
      if (seenChapters.has(key)) continue;
      seenChapters.add(key);
      chapters.push({ ...chapter, index: chapters.length });
    }
    const next = sourceRuleText(response.data, r.nextTocUrl);
    pageUrl = next ? url(next, response.url) : '';
  }
  return chapters;
}
export async function loadChapterPayload(
  source: BookSource,
  chapter: BookChapter,
) {
  if (chapter.isVolume) return { content: '', subContent: '' };
  const r = rule(source, 'ruleContent'),
    seenPages = new Set<string>(),
    contents: string[] = [],
    subContents: string[] = [];
  let pageUrl = chapter.url;
  for (
    let page = 1;
    page <= 50 && pageUrl && !seenPages.has(pageUrl);
    page += 1
  ) {
    seenPages.add(pageUrl);
    const response = await executeSourceRequest(
        buildSourceRequest(source, pageUrl, '', page),
      ),
      main =
        typeof response.data === 'string' && !String(r.content ?? '').trim()
          ? response.data
          : sourceRuleTexts(response.data, r.content)
              .filter(Boolean)
              .join('\n'),
      sub = sourceRuleTexts(response.data, r.subContent)
        .filter(Boolean)
        .join('\n');
    if (main)
      contents.push(
        source.bookSourceType === 4
          ? main
          : readerHtmlToText(main, response.url),
      );
    if (sub) {
      if (/^https?:\/\//i.test(sub.trim())) {
        const subResponse = await executeSourceRequest(
          buildSourceRequest(source, sub.trim()),
        );
        subContents.push(
          typeof subResponse.data === 'string'
            ? subResponse.data
            : JSON.stringify(subResponse.data),
        );
      } else subContents.push(sub);
    }
    const next = sourceRuleText(response.data, r.nextContentUrl);
    pageUrl = next ? url(next, response.url) : '';
  }
  if (!contents.length)
    throw new SourceRuleError('正文为空', source.bookSourceName);
  let content =
    source.bookSourceType === 4
      ? contents.join('\n').trim()
      : contents.join('\n').trim();
  const replace = String(r.replaceRegex ?? '').trim();
  if (replace) {
    if (replace.includes('@js:') || replace.includes('<js>'))
      throw new UnsupportedRuleError(
        'JavaScript 正文替换',
        source.bookSourceName,
      );
    const parts = replace.split('##'),
      [pattern, replacement = ''] =
        parts[0] === '' && parts.length > 1
          ? [parts.slice(1).join('##'), '']
          : [parts[0], parts.slice(1).join('##')];
    try {
      content = content.replace(new RegExp(pattern, 'g'), replacement);
    } catch {
      throw new SourceRuleError('正文替换正则无效', source.bookSourceName);
    }
  }
  return { content, subContent: subContents.join('\n').trim() };
}

export async function loadChapterContent(
  source: BookSource,
  chapter: BookChapter,
) {
  return (await loadChapterPayload(source, chapter)).content;
}
