import type { BookChapter, BookSource, SearchBook } from '../types';
import { EmptyTocError, SourceRuleError, SourceVerificationCancelledError, UnsupportedRuleError } from './errors';
import { buildSourceSearchRequest, buildSourcePageRequest, executeSourceRequest, mergeRequestCookies, type SourceRequest } from './sourceRequest';
import {
  sourceRuleText,
  sourceRuleTexts,
  sourceRuleValues,
  sourceRuleTextAsync,
  sourceRuleTextsAsync,
  sourceRuleValuesAsync,
  type SourceRuleContext,
  type SourceRuleScriptRunner,
} from './sourceRule';
import { readerHtmlToText, formattedSourceToReaderContent } from './readerImages';
import { formatSourceChapter, unescapeSourceHtml4 } from './htmlFormatter';
import { checkCancelled } from './cancellation';
import { loadReaderPreferences } from '../data/readerPreferences';
import { resolveNativeResourceUrl } from './nativeSourceUrl';
import { formatNativeBookAuthor, formatNativeBookName, formatNativeWordCount } from './nativeBookMetadata';
import { compileSourceRegex } from './sourceRegex';
import { loadGeneralPreferences } from '../data/generalPreferences';
import { clearSourceCookies, sourceCookieHeader } from '../data/sourceCookies';
import { runSourceJavaScriptAsync, type SourceJavaScriptBridge, type SourceJavaScriptResponse, type SourceJavaScriptRunner } from './sourceJavaScript';
import jssdk from '@htyf-mp/js-sdk';
import { sourceVerification } from './sourceVerification';
import { parseSourceVariables as bookVariables, serializeSourceVariables as variableText } from './sourceVariables';
import { sourceRuntimeVariables } from '../data/runtimeSourceCache';

type SourcePage = { data: unknown; url: string };
export type SourceRunnerOptions = {runJavaScript?:SourceJavaScriptRunner; runRuleJavaScript?:SourceRuleScriptRunner};
type AbortableSourceRunnerOptions = SourceRunnerOptions & {signal?:AbortSignal};
const sourceOrigin = (value: string) => /^https?:\/\/([^/?#]+)/i.exec(value)?.[1].toLowerCase();
function sourceScriptPost(source: BookSource, signal?: AbortSignal, onRequest?: () => void) {
  const allowedOrigin = sourceOrigin(source.bookSourceUrl);
  return async (address: string, body: string, supplied: Record<string, string>, timeout?: number): Promise<SourceJavaScriptResponse> => {
    checkCancelled(signal);
    onRequest?.();
    if (!allowedOrigin || sourceOrigin(address) !== allowedOrigin)
      throw new SourceRuleError('JavaScript 请求地址不属于当前书源', source.bookSourceName);
    const headers = {...supplied};
    if (!Object.keys(headers).some(name => name.toLowerCase() === 'content-type'))
      headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
    if (!Object.keys(headers).some(name => name.toLowerCase() === 'user-agent'))
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36';
    const stored = source.enabledCookieJar ? sourceCookieHeader(source.bookSourceUrl) : '';
    if (stored) {
      const key = Object.keys(headers).find(name => name.toLowerCase() === 'cookie') ?? 'Cookie';
      headers[key] = mergeRequestCookies(stored, headers[key] ?? '');
    }
    const request: SourceRequest = {
      url:address, method:'POST', body, headers, sourceId:source.bookSourceUrl,
      cookieJar:source.enabledCookieJar === true,
      concurrentRate:typeof source.concurrentRate === 'string' ? source.concurrentRate : undefined,
      sensitiveHeaderNames:Object.keys(headers), scriptPost:true,
    };
    const response = await executeSourceRequest(request, timeout ?? 30_000, signal, true);
    return {...response, body:response.body ?? '', code:response.code ?? 200};
  };
}
async function sourceBrowserVerification(source: BookSource, address: string, title: string, refetch: boolean, html: string | undefined, signal: AbortSignal | undefined, connect: (url: string) => Promise<SourceJavaScriptResponse>): Promise<SourceJavaScriptResponse> {
  const next = buildSourcePageRequest(source, address);
  const allowedOrigin = sourceOrigin(source.bookSourceUrl);
  if (!allowedOrigin || sourceOrigin(next.url) !== allowedOrigin)
    throw new SourceRuleError('浏览器验证地址不属于当前书源', source.bookSourceName);
  const verification = await sourceVerification.request({sourceUrl:source.bookSourceUrl, url:next.url, title, headers:next.headers, refetch, html}, signal);
  checkCancelled(signal);
  if (refetch) return connect(next.url);
  let data: unknown = verification.html;
  try { data = JSON.parse(verification.html) as unknown; } catch { /* HTML is the common case. */ }
  return {data, body:verification.html, url:verification.url, code:200};
}

/** Match AnalyzeUrl's script blocks before expanding URL placeholders. */
async function resolveSearchUrlScripts(rule: string, bridge: SourceJavaScriptBridge, runJavaScript:SourceJavaScriptRunner = runSourceJavaScriptAsync, signal?:AbortSignal): Promise<string> {
  const pattern = /<js>([\s\S]*?)<\/js>|@js:([\s\S]*)/gi;
  let result = rule, start = 0, count = 0, match: RegExpExecArray | null;
  while ((match = pattern.exec(rule))) {
    if (++count > 64) throw new SourceRuleError('JavaScript URL 表达式超过限制');
    const prefix = rule.slice(start, match.index).trim();
    if (prefix) result = prefix.split('@result').join(result);
    const value = await runJavaScript(match[2] ?? match[1], bridge, result, signal);
    result = String(value);
    start = pattern.lastIndex;
  }
  if (start) {
    const suffix = rule.slice(start).trim();
    if (suffix) result = suffix.split('@result').join(result);
  }
  return result;
}

async function executeCheckedSourceRequest(source: BookSource, request: SourceRequest, signal?: AbortSignal, context?: {key?: string; page?: number; baseUrl?: string; variables?: Map<string, string>; fallbackVariables?: Map<string, string>; bookName?: string; chapterTitle?: string}, runJavaScript:SourceJavaScriptRunner = runSourceJavaScriptAsync, coordinate?:(finish:()=>Promise<SourcePage>)=>Promise<SourcePage>): Promise<SourcePage> {
  const script = typeof source.loginCheckJs === 'string' ? source.loginCheckJs.trim() : '';
  if (!script) {
    const response = await executeSourceRequest(request, 15000, signal);
    return coordinate ? coordinate(async()=>response) : response;
  }
  const allowedOrigin = sourceOrigin(source.bookSourceUrl);
  const evaluate = async (initialResponse: SourceJavaScriptResponse): Promise<SourceJavaScriptResponse> => {
    const responses = new Set<SourceJavaScriptResponse>([initialResponse]);
    const connect = async (address: string) => {
      checkCancelled(signal);
      const next = buildSourcePageRequest(source, address);
      if (!allowedOrigin || sourceOrigin(next.url) !== allowedOrigin)
        throw new SourceRuleError('JavaScript 请求地址不属于当前书源', source.bookSourceName);
      const response = await executeSourceRequest(next, 15000, signal, true);
      const nextResponse = { ...response, body: response.body ?? (typeof response.data === 'string' ? response.data : JSON.stringify(response.data)), code: response.code ?? 200 };
      responses.add(nextResponse);
      return nextResponse;
    };
    const result = await runJavaScript(script, {
      baseUrl: context?.baseUrl ?? source.bookSourceUrl, sourceUrl: source.bookSourceUrl,
      key: context?.key ?? null, page: context?.page ?? null, response: initialResponse, variables: context?.variables,
      fallbackVariables: context?.fallbackVariables, bookName: context?.bookName, chapterTitle: context?.chapterTitle,
      sourceVariables: sourceRuntimeVariables(source.bookSourceUrl),
      onResponse: response => { responses.add(response); },
      removeCookie: address => { if (allowedOrigin && sourceOrigin(address) === allowedOrigin) clearSourceCookies(source.bookSourceUrl); },
      getCookie: address => allowedOrigin && sourceOrigin(address) === allowedOrigin ? sourceCookieHeader(source.bookSourceUrl) : '',
      post: async (address, body, headers, timeout) => {
        const response = await sourceScriptPost(source, signal)(address, body, headers, timeout);
        responses.add(response);
        return response;
      },
      connect,
      ajax: async address => (await connect(address)).body,
      toast: (message, long) => { void jssdk.showToast({type:'info', title:`${source.bookSourceName}: ${message}`, duration:long ? 3500 : 2000}).catch(() => undefined); },
      browser: async (address, title, refetch, html) => {
        const page = await sourceBrowserVerification(source, address, title, refetch, html, signal, connect);
        responses.add(page);
        return page;
      },
    }, undefined, signal);
    checkCancelled(signal);
    if (!result || typeof result !== 'object' || !responses.has(result as SourceJavaScriptResponse))
      throw new SourceRuleError('登录检查必须返回响应对象', source.bookSourceName);
    return result as SourceJavaScriptResponse;
  };
  const initial = await executeSourceRequest(request, 15000, signal, true)
    .then(value => ({ok:true as const,value}), error => ({ok:false as const,error}));
  const finish = async ():Promise<SourcePage> => {
    try {
      if (!initial.ok) throw initial.error;
      return await evaluate({
        ...initial.value,
        body: initial.value.body ?? (typeof initial.value.data === 'string' ? initial.value.data : JSON.stringify(initial.value.data)),
        code: initial.value.code ?? 200,
      });
    } catch (original) {
      checkCancelled(signal);
      if (original instanceof SourceVerificationCancelledError) throw original;
      const body = original instanceof Error ? (original.stack || original.message) : String(original);
      try {
        const recovered = await evaluate({data:body, body, url:request.url, code:500});
        if (recovered.code !== 500) return recovered;
      } catch { checkCancelled(signal); }
      throw original;
    }
  };
  return coordinate ? coordinate(finish) : finish();
}
// Native Book.infoHtml / tocHtml are transient, not database columns. Weak
// maps likewise keep the response only while its search result is alive.
const infoPages = new WeakMap<SearchBook, SourcePage>();
const tocPages = new WeakMap<SearchBook, SourcePage>();
function matchesDetailUrl(pattern: string, value: string) {
  const compiled = compileSourceRegex(pattern);
  return new RegExp(`^(?:${compiled.source})$(?![\\s\\S])`, compiled.flags.replace('g', '')).test(value);
}
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
  return resolveNativeResourceUrl(value, base);
};
const url = resolveWebBookUrl;
const optionalUrl = (value: string, base: string) =>
  value ? url(value, base) : undefined;
const optionalRuleText = (
  value: unknown,
  ruleValue: unknown,
  isUrl = false,
  context?: { baseUrl: string },
) => {
  try {
    return sourceRuleText(value, ruleValue, isUrl, context);
  } catch (error) {
    if (error instanceof UnsupportedRuleError) return '';
    throw error;
  }
};
// Native book metadata treats category and word-count extraction as optional.
const metadataKind = (value: unknown, ruleValue: unknown, context?: { baseUrl: string }) => {
  try {
    return sourceRuleTexts(value, ruleValue, context).join(',');
  } catch {
    return '';
  }
};
const metadataWordCount = (value: unknown, ruleValue: unknown, context?: { baseUrl: string }) => {
  try {
    return formatNativeWordCount(sourceRuleText(value, ruleValue, false, context)) ?? '';
  } catch {
    return '';
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
function* parseSearchBookSteps(
  source: BookSource,
  data: unknown,
  baseUrl: string,
  options: { isSearch?: boolean; requestUrl?: string; variables?: Map<string, string> } = {},
): Generator<InfoStep,SearchBook[],unknown> {
  const r = rule(source, 'ruleSearch');
  const pattern = source.bookUrlPattern;
  function* detail():Generator<InfoStep,SearchBook[],unknown> {
    const bookUrl = options.requestUrl && options.requestUrl === baseUrl
      ? options.requestUrl : baseUrl;
    const variables = new Map(options.variables ?? []);
    const book: SearchBook = { bookUrl, origin: source.bookSourceUrl,
      originName: source.bookSourceName, sourceType: source.bookSourceType,
      name: '', author: '', ...(variables.size ? {variable:variableText(variables)} : {}) };
    const info = yield* parseBookInfoSteps(source, book, { data, url: baseUrl }, false, variables);
    if (!info.name.trim()) return [];
    infoPages.set(info, { data, url: info.bookUrl });
    return [info];
  }
  if (options.isSearch !== false && pattern != null && matchesDetailUrl(pattern, baseUrl))
    return yield* detail();
  // BookList consumes these direction flags before AnalyzeRule sees the rule.
  let listRule = String(r.bookList ?? '');
  const reverse = listRule.startsWith('-');
  if (reverse) listRule = listRule.slice(1);
  if (listRule.startsWith('+')) listRule = listRule.slice(1);
  const context = { baseUrl, redirectUrl: baseUrl, variables: options.variables ?? new Map<string, string>(), sourceUrl: source.bookSourceUrl, sourceVariables: sourceRuntimeVariables(source.bookSourceUrl) };
  const items = yield* infoStep<unknown[]>('values',data,listRule,context),
    seen = new Set<string>();
  if (!items.length && !pattern) return yield* detail();
  const mapped:SearchBook[] = [];
  for (const item of items) {
      const variables = new Map(context.variables), itemContext = {...context, variables};
      const name = formatNativeBookName(yield* infoStep<string>('text',item,r.name,itemContext)),
        author = formatNativeBookAuthor(yield* infoStep<string>('optional',item,r.author,itemContext)),
        kind = (yield* infoStep<string>('kind',item,r.kind,itemContext)) || undefined,
        wordCount = (yield* infoStep<string>('wordCount',item,r.wordCount,itemContext)) || undefined,
        latestChapterTitle = (yield* infoStep<string>('optional',item,r.lastChapter,itemContext)) || undefined,
        intro = yield* infoStep<string>('optional',item,r.intro,itemContext),
        coverUrl = optionalUrl(yield* infoStep<string>('optional',item,r.coverUrl,itemContext,true), baseUrl),
        bookUrl = url(
          (yield* infoStep<string>('text',item,r.bookUrl,itemContext,true)) || baseUrl,
          baseUrl,
        );
      mapped.push({
        bookUrl,
        origin: source.bookSourceUrl,
        originName: source.bookSourceName,
        sourceType: source.bookSourceType,
        name,
        author,
        kind,
        coverUrl,
        intro: intro ? readerHtmlToText(intro, baseUrl) : undefined,
        wordCount,
        latestChapterTitle,
        ...(variables.size ? {variable:variableText(variables)} : {}),
      });
  }
  const books = mapped.filter(
      book =>
        !!book.name && !seen.has(book.bookUrl) && !!seen.add(book.bookUrl),
    );
  for (const book of books)
    if (book.bookUrl === baseUrl) infoPages.set(book, { data, url: baseUrl });
  return reverse ? books.reverse() : books;
}
export function parseSearchBooks(...args:Parameters<typeof parseSearchBookSteps>):SearchBook[] {
  return runInfoSteps(parseSearchBookSteps(...args));
}
export async function searchSource(
  source: BookSource,
  key: string,
  page = 1,
  signal?: AbortSignal,
  options?: SourceRunnerOptions,
) {
  checkCancelled(signal);
  if (!source.enabled) return [];
  if (!source.searchUrl)
    throw new SourceRuleError('搜索 URL 为空', source.bookSourceName);
  const origin = (url: string) => /^https?:\/\/([^/?#]+)/i.exec(url)?.[1].toLowerCase();
  const allowedOrigin = origin(source.bookSourceUrl);
  let scriptRequests = 0;
  const variables = new Map<string, string>();
  const connect = async (address: string): Promise<SourceJavaScriptResponse> => {
    checkCancelled(signal);
    if (++scriptRequests > 8) throw new SourceRuleError('JavaScript 请求次数超过限制', source.bookSourceName);
    const next = buildSourcePageRequest(source, address);
    if (!allowedOrigin || origin(next.url) !== allowedOrigin)
      throw new SourceRuleError('JavaScript 请求地址不属于当前书源', source.bookSourceName);
    const response = await executeSourceRequest(next, 15000, signal, true);
    return { ...response, body: response.body ?? (typeof response.data === 'string' ? response.data : JSON.stringify(response.data)), code: response.code ?? 200 };
  };
  const bridge = {
      baseUrl: source.bookSourceUrl,
      sourceUrl: source.bookSourceUrl,
      sourceVariables: sourceRuntimeVariables(source.bookSourceUrl),
      key,
      page,
      variables,
      removeCookie: (address: string) => {
        if (allowedOrigin && origin(address) === allowedOrigin) clearSourceCookies(source.bookSourceUrl);
      },
      getCookie: (address: string) => allowedOrigin && origin(address) === allowedOrigin ? sourceCookieHeader(source.bookSourceUrl) : '',
      post: sourceScriptPost(source, signal, () => {
        if (++scriptRequests > 8) throw new SourceRuleError('JavaScript 请求次数超过限制', source.bookSourceName);
      }),
      connect,
      ajax: async (address: string) => (await connect(address)).body,
      browser: (address: string, title: string, refetch: boolean, html?: string) => sourceBrowserVerification(source, address, title, refetch, html, signal, connect),
      toast: (message: string, long?: boolean) => { void jssdk.showToast({type:'info', title:`${source.bookSourceName}: ${message}`, duration:long ? 3500 : 2000}).catch(() => undefined); },
    };
  const runJavaScript = options?.runJavaScript ?? runSourceJavaScriptAsync;
  const resolvedRule = await resolveSearchUrlScripts(source.searchUrl, bridge, runJavaScript, signal);
  if (!resolvedRule.trim()) throw new SourceRuleError('JavaScript 搜索地址为空', source.bookSourceName);
  const request = await buildSourceSearchRequest(source, resolvedRule, key, page, bridge, runJavaScript, signal);
  const response = await executeCheckedSourceRequest(source, request, signal, {key, page, variables}, runJavaScript);
  const args:Parameters<typeof parseSearchBookSteps> = [source,response.data,response.url,{requestUrl:request.url,variables}];
  const books = options?.runRuleJavaScript
    ? await runInfoStepsAsync(parseSearchBookSteps(...args),options.runRuleJavaScript,signal)
    : parseSearchBooks(...args);
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
  requestUrl = baseUrl,
): SearchBook[] {
  const exploreRule = rule(source, 'ruleExplore');
  return parseSearchBooks(
    {
      ...source,
      ruleSearch: String(exploreRule.bookList ?? '').trim()
        ? exploreRule
        : rule(source, 'ruleSearch'),
    },
    data,
    baseUrl,
    { isSearch: false, requestUrl },
  );
}
export async function exploreSource(
  source: BookSource,
  entry: ExploreEntry,
  page = 1,
  options?: AbortableSourceRunnerOptions,
) {
  checkCancelled(options?.signal);
  if (!source.enabled || !source.enabledExplore) return [];
  const request = buildSourcePageRequest(source, entry.url, page);
  const response = await executeCheckedSourceRequest(source, request, options?.signal, {page}, options?.runJavaScript);
  checkCancelled(options?.signal);
  if (!options?.runRuleJavaScript) return parseExploreBooks(source, response.data, response.url, request.url);
  const exploreRule=rule(source,'ruleExplore');
  const searchSourceRules={...source,ruleSearch:String(exploreRule.bookList ?? '').trim()?exploreRule:rule(source,'ruleSearch')};
  return runInfoStepsAsync(parseSearchBookSteps(searchSourceRules,response.data,response.url,{isSearch:false,requestUrl:request.url}),options.runRuleJavaScript,options.signal);
}
type InfoStep = {kind:'values'|'texts'|'text'|'optional'|'kind'|'wordCount';value:unknown;rule:unknown;context:SourceRuleContext;isUrl?:boolean};
function* infoStep<T>(kind:InfoStep['kind'],value:unknown,ruleValue:unknown,context:SourceRuleContext,isUrl=false):Generator<InfoStep,T,unknown> {
  return (yield {kind,value,rule:ruleValue,context,isUrl}) as T;
}
function* parseBookInfoSteps(
  source: BookSource,
  book: SearchBook,
  response: SourcePage,
  allowRename = true,
  variables = bookVariables(book.variable),
): Generator<InfoStep,SearchBook,unknown> {
  const context = { baseUrl: book.bookUrl, redirectUrl: response.url, variables, sourceUrl:source.bookSourceUrl, sourceVariables:sourceRuntimeVariables(source.bookSourceUrl) };
  const r = rule(source, 'ruleBookInfo'),
    initialized = r.init
      ? ((yield* infoStep<unknown[]>('values',response.data,String(r.init),context))[0] ?? response.data)
      : response.data;
  const intro = yield* infoStep<string>('text',initialized,r.intro,context);
  const canRename = allowRename && String(r.canReName ?? '').trim().length > 0;
  const downloadUrls = source.bookSourceType === 3
    ? [...new Set((yield* infoStep<string[]>('texts',initialized,r.downloadUrls,context))
        .flatMap(value => value.split('\n'))
        .filter(value => value.trim())
        .map(value => url(value, response.url))
        .filter(Boolean))]
    : undefined;
  if (downloadUrls && !downloadUrls.length)
    throw new SourceRuleError('下载链接为空', source.bookSourceName);
  const info = {
    ...book,
    name:
      book.name && !canRename
        ? book.name
        : formatNativeBookName(yield* infoStep<string>('text',initialized,r.name,context)) || book.name,
    author:
      book.author && !canRename
        ? book.author
        : formatNativeBookAuthor(yield* infoStep<string>('text',initialized,r.author,context)) || book.author,
    kind: (yield* infoStep<string>('kind',initialized,r.kind,context)) || book.kind,
    wordCount: (yield* infoStep<string>('wordCount',initialized,r.wordCount,context)) || book.wordCount,
    intro: intro ? readerHtmlToText(intro, response.url) : book.intro,
    coverUrl:
      optionalUrl(
        yield* infoStep<string>('text',initialized,r.coverUrl,context,true),
        response.url,
      ) || book.coverUrl,
    ...(downloadUrls ? { downloadUrls } : { tocUrl: url(
      resolveBookInfoTocUrl(
        r.tocUrl,
        resolveBookInfoTocUrl(r.tocUrl, '', book.bookUrl) || (yield* infoStep<string>('optional',initialized,r.tocUrl,context,true)),
        book.bookUrl,
      ) || book.bookUrl,
      response.url,
    ) }),
    latestChapterTitle:
      (yield* infoStep<string>('text',initialized,r.lastChapter,context)) || book.latestChapterTitle,
  };
  if (variables.size) info.variable = variableText(variables);
  if (info.tocUrl === info.bookUrl) tocPages.set(info, { data: response.data, url: info.tocUrl });
  return info;
}
function parseBookInfo(...args:Parameters<typeof parseBookInfoSteps>):SearchBook {
  return runInfoSteps(parseBookInfoSteps(...args));
}
function runInfoSteps<T>(steps:Generator<InfoStep,T,unknown>):T {
  let current=steps.next();
  while(!current.done){const s=current.value;let value:unknown;
    if(s.kind==='values')value=sourceRuleValues(s.value,s.rule,s.context);
    else if(s.kind==='texts')value=sourceRuleTexts(s.value,s.rule,s.context);
    else if(s.kind==='kind')value=metadataKind(s.value,s.rule,s.context as {baseUrl:string});
    else if(s.kind==='wordCount')value=metadataWordCount(s.value,s.rule,s.context as {baseUrl:string});
    else if(s.kind==='optional')value=optionalRuleText(s.value,s.rule,s.isUrl,s.context as {baseUrl:string});
    else value=sourceRuleText(s.value,s.rule,s.isUrl,s.context);
    current=steps.next(value);
  }
  return current.value;
}
async function parseBookInfoAsync(args:Parameters<typeof parseBookInfoSteps>,runner:SourceRuleScriptRunner,signal?:AbortSignal):Promise<SearchBook> {
  return runInfoStepsAsync(parseBookInfoSteps(...args),runner,signal);
}
async function runInfoStepsAsync<T>(steps:Generator<InfoStep,T,unknown>,runner:SourceRuleScriptRunner,signal?:AbortSignal):Promise<T> {
  checkCancelled(signal);let current=steps.next();
  while(!current.done){const s=current.value;let value:unknown;
    try {
      if(s.kind==='values')value=await sourceRuleValuesAsync(s.value,s.rule,s.context,runner,signal);
      else if(s.kind==='texts')value=await sourceRuleTextsAsync(s.value,s.rule,s.context,runner,signal);
      else if(s.kind==='kind')value=(await sourceRuleTextsAsync(s.value,s.rule,s.context,runner,signal)).join(',');
      else if(s.kind==='wordCount')value=formatNativeWordCount(await sourceRuleTextAsync(s.value,s.rule,false,s.context,runner,signal))??'';
      else value=await sourceRuleTextAsync(s.value,s.rule,!!s.isUrl,s.context,runner,signal);
    } catch(error) {
      checkCancelled(signal);
      if(s.kind==='kind'||s.kind==='wordCount'||(s.kind==='optional'&&error instanceof UnsupportedRuleError))value='';
      else throw error;
    }
    checkCancelled(signal);current=steps.next(value);
  }
  checkCancelled(signal);return current.value;
}
export async function loadBookInfo(
  source: BookSource,
  book: SearchBook,
  signal?: AbortSignal,
  options?: SourceRunnerOptions,
): Promise<SearchBook> {
  checkCancelled(signal);
  const variables = bookVariables(book.variable);
  const cached = infoPages.get(book);
  const response = (cached?.url === book.bookUrl ? cached : undefined) ?? await executeCheckedSourceRequest(
    source, buildSourcePageRequest(source, book.bookUrl), signal, {variables}, options?.runJavaScript,
  );
  checkCancelled(signal);
  return options?.runRuleJavaScript
    ? parseBookInfoAsync([source,book,response,true,variables],options.runRuleJavaScript,signal)
    : parseBookInfo(source, book, response, true, variables);
}
type TocRuleStep = {kind:'values'|'texts'|'text'|'optional'; value:unknown; rule:unknown; context?:SourceRuleContext};
type TocResult = {chapters:BookChapter[];next:string[]};
function* tocValues(value:unknown, ruleValue:unknown, context?:SourceRuleContext):Generator<TocRuleStep,unknown[],unknown> {
  return (yield {kind:'values',value,rule:ruleValue,context}) as unknown[];
}
function* tocTexts(value:unknown, ruleValue:unknown, context?:SourceRuleContext):Generator<TocRuleStep,string[],unknown> {
  return (yield {kind:'texts',value,rule:ruleValue,context}) as string[];
}
function* tocText(value:unknown, ruleValue:unknown, context?:SourceRuleContext, optional=false):Generator<TocRuleStep,string,unknown> {
  return (yield {kind:optional?'optional':'text',value,rule:ruleValue,context}) as string;
}
function* parseTocPageSteps(
  source: BookSource,
  book: SearchBook,
  data: unknown,
  baseUrl: string,
  requestedUrl: string,
  bookVars: Map<string, string>,
  includeNext: boolean,
):Generator<TocRuleStep,TocResult,unknown> {
  const r = rule(source, 'ruleToc');
  const context = { baseUrl: requestedUrl, redirectUrl: baseUrl, variables: bookVars, variableBookName: book.name, sourceUrl:source.bookSourceUrl, sourceVariables:sourceRuntimeVariables(source.bookSourceUrl) };
  let listRule = String(r.chapterList ?? '');
  if (listRule.startsWith('-')) listRule = listRule.slice(1);
  if (listRule.startsWith('+')) listRule = listRule.slice(1);
  const items = yield* tocValues(data, listRule, context);
  const next = includeNext ? [...new Set((yield* tocTexts(data, r.nextTocUrl, context))
    .flatMap(value => value.split('\n'))
    .map(value => value.trim() ? url(value, baseUrl) : '')
    .filter(value => !!value && value !== baseUrl))] : [];
  const nativeTrue = (value: string) => value !== 'null' && !!value.trim() && !/^(?:false|no|not|0|0.0)$/i.test(value.trim());
  const countWords = loadGeneralPreferences().tocCountWords;
  const chapters: BookChapter[] = [];
  for (const [index,item] of items.entries()) {
      const variables = new Map<string, string>();
      const itemContext = { ...context, variables, fallbackVariables: bookVars, title: '' };
      const title = yield* tocText(item, r.chapterName, itemContext);
      itemContext.title = title;
      const qidianScript = typeof r.chapterUrl === 'string' &&
        r.chapterUrl.includes('baseUrl.match(/\\d+/)') &&
        r.chapterUrl.includes("'https://vipreader.qidian.com/chapter/'");
      let chapterUrl = qidianScript ? '' : yield* tocText(item, r.chapterUrl, itemContext);
      if (
        !chapterUrl &&
        typeof r.chapterUrl === 'string' &&
        r.chapterUrl.includes('baseUrl.match(/\\d+/)') &&
        r.chapterUrl.includes("'https://vipreader.qidian.com/chapter/'")
      ) {
        const bid = (book.bookUrl.match(/\d+/) ?? baseUrl.match(/\d+/))?.[0],
          chapterId = yield* tocText(item, '$3');
        if (bid && chapterId)
          chapterUrl = `https://vipreader.qidian.com/chapter/${bid}/${chapterId}/`;
      }
      let tag = yield* tocText(item, r.updateTime, itemContext, true), wordCount: string | undefined;
      const isVolume = nativeTrue(yield* tocText(item, r.isVolume, itemContext));
      const rawUrl = chapterUrl || (isVolume ? `${title}${index}` : requestedUrl);
      if (!isVolume && countWords) {
        const match = /(?:^|字数[：:、]?|\s+)([0-9万千百.]{1,6}字)/.exec(tag);
        if (match) { wordCount = match[1].trim(); tag = tag.replace(match[0], ''); }
      }
      const chapter:BookChapter = {
        url: !chapterUrl && isVolume ? rawUrl : url(rawUrl, baseUrl),
        sourceUrl: rawUrl,
        title,
        index,
        bookUrl: book.bookUrl,
        baseUrl,
        isVolume,
        isVip: nativeTrue(yield* tocText(item, r.isVip, itemContext)),
        isPay: nativeTrue(yield* tocText(item, r.isPay, itemContext)),
        tag: tag || undefined,
        wordCount,
        ...(variables.size ? {variable: variableText(variables)} : {}),
      };
      if (chapter.title) chapters.push(chapter);
  }
  return { chapters, next };
}

function parseTocPage(...args:Parameters<typeof parseTocPageSteps>):TocResult {
  const steps=parseTocPageSteps(...args);let current=steps.next();
  while(!current.done){const step=current.value;let result:unknown;
    if(step.kind==='values') result=sourceRuleValues(step.value,step.rule,step.context);
    else if(step.kind==='texts') result=sourceRuleTexts(step.value,step.rule,step.context);
    else if(step.kind==='optional') result=optionalRuleText(step.value,step.rule,false,step.context as {baseUrl:string}|undefined);
    else result=sourceRuleText(step.value,step.rule,false,step.context);
    current=steps.next(result);
  }
  return current.value;
}
async function parseTocPageAsync(args:Parameters<typeof parseTocPageSteps>,runner:SourceRuleScriptRunner,signal?:AbortSignal):Promise<TocResult> {
  checkCancelled(signal);const steps=parseTocPageSteps(...args);let current=steps.next();
  while(!current.done){const step=current.value;let result:unknown;
    try {
      if(step.kind==='values') result=await sourceRuleValuesAsync(step.value,step.rule,step.context,runner,signal);
      else if(step.kind==='texts') result=await sourceRuleTextsAsync(step.value,step.rule,step.context,runner,signal);
      else result=await sourceRuleTextAsync(step.value,step.rule,false,step.context,runner,signal);
    } catch(error) { if(step.kind==='optional' && error instanceof UnsupportedRuleError) result='';else throw error; }
    checkCancelled(signal);current=steps.next(result);
  }
  checkCancelled(signal);return current.value;
}

export function parseChapters(
  source: BookSource,
  book: SearchBook,
  data: unknown,
  baseUrl: string,
  requestedUrl = baseUrl,
  bookVars = bookVariables(book.variable),
): BookChapter[] {
  return parseTocPage(source, book, data, baseUrl, requestedUrl, bookVars, false).chapters;
}

/** BookChapterList reverses before LinkedHashSet and optionally reverses again. */
export function finalizeChapterOrder(chapters: BookChapter[], reverse: boolean, reverseToc: boolean) {
  const ordered = reverse ? [...chapters] : [...chapters].reverse();
  const seen = new Set<string>();
  const unique = ordered.filter(chapter => {
    const key = chapter.sourceUrl ?? chapter.url;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  if (!reverseToc) unique.reverse();
  return unique.map((chapter, index) => {
    const updated = { ...chapter, index };
    if (unique[index + 1]?.url) updated.nextChapterUrl = unique[index + 1].url;
    else delete updated.nextChapterUrl;
    return updated;
  });
}
export async function loadChapters(
  source: BookSource,
  book: SearchBook,
  signal?: AbortSignal,
  options?: SourceRunnerOptions,
) {
  checkCancelled(signal);
  const r = rule(source, 'ruleToc');
  const reverse = String(r.chapterList ?? '').startsWith('-');
  const firstUrl = book.tocUrl || book.bookUrl;
  const initialVariable = book.variable;
  const variables = bookVariables(initialVariable);
  const initialVariables = variableText(variables);
  // Synchronous page parsing runs to completion before another page can touch
  // book variables. Preserve that ordering when rule execution can suspend.
  let parsing:Promise<void> = Promise.resolve();
  let parsingFailed = false, parsingError:unknown;
  const parseQueued = <T>(work:()=>Promise<T>, pageSignal?:AbortSignal):Promise<T> => {
    const task = parsing.then(() => { if (parsingFailed) throw parsingError; checkCancelled(pageSignal); return work(); });
    parsing = task.then(() => undefined, error => { parsingFailed = true; parsingError = error; });
    if (!pageSignal) return task;
    return new Promise<T>((resolve,reject) => {
      const cleanup = () => pageSignal.removeEventListener('abort',cancel);
      const cancel = () => { cleanup(); try { checkCancelled(pageSignal); } catch(error) { reject(error); } };
      pageSignal.addEventListener('abort',cancel,{once:true});
      task.then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
      if (pageSignal.aborted) cancel();
    });
  };
  const readPage = async (pageUrl: string, pageSignal?: AbortSignal, cached?: SourcePage, useResponseUrl = true, includeNext = true) => {
    checkCancelled(pageSignal);
    const parse = async (response:SourcePage) => {
      checkCancelled(pageSignal);
      const redirectUrl = useResponseUrl ? response.url : pageUrl;
      const args:Parameters<typeof parseTocPageSteps> = [source, book, response.data, redirectUrl, pageUrl, variables, includeNext];
      const {chapters, next} = options?.runRuleJavaScript
        ? await parseTocPageAsync(args, options.runRuleJavaScript, pageSignal)
        : parseTocPage(...args);
      return { chapters, next, redirectUrl };
    };
    if (cached) return options?.runRuleJavaScript ? parseQueued(()=>parse(cached),pageSignal) : parse(cached);
    let parsed:Awaited<ReturnType<typeof parse>>|undefined;
    const coordinate = options?.runRuleJavaScript ? (finish:()=>Promise<SourcePage>) => parseQueued(async()=>{
      const response = await finish();parsed = await parse(response);return response;
    },pageSignal) : undefined;
    const response = await executeCheckedSourceRequest(source, buildSourcePageRequest(source, pageUrl), pageSignal, {baseUrl: book.bookUrl, variables}, options?.runJavaScript, coordinate);
    return parsed ?? parse(response);
  };
  const cached = book.tocUrl === book.bookUrl ? tocPages.get(book) : undefined;
  const first = await readPage(firstUrl, signal, cached?.url === firstUrl ? cached : undefined);
  const chapters = [...first.chapters];
  if (first.next.length === 1) {
    const seen = new Set([first.redirectUrl]);
    let next = first.next[0];
    while (next && !seen.has(next)) {
      seen.add(next);
      const page = await readPage(next, signal, undefined, false);
      chapters.push(...page.chapters);
      next = page.next[0] ?? '';
    }
  } else if (first.next.length > 1) {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal?.addEventListener('abort', cancel);
    if (signal?.aborted) cancel();
    const pages: BookChapter[][] = new Array(first.next.length);
    let cursor = 0;
    try {
      await Promise.all(Array.from({ length: Math.min(first.next.length, loadGeneralPreferences().threadCount) }, async () => {
        while (cursor < first.next.length) {
          checkCancelled(controller.signal);
          const index = cursor++;
          try { pages[index] = (await readPage(first.next[index], controller.signal, undefined, true, false)).chapters; }
          catch (error) { controller.abort(); throw error; }
        }
      }));
      pages.forEach(page => chapters.push(...page));
    } finally { signal?.removeEventListener('abort', cancel); }
  }
  if (!chapters.length) throw new EmptyTocError(source.bookSourceName);
  if (book.variable === initialVariable && variableText(variables) !== initialVariables)
    book.variable = variableText(variables);
  return finalizeChapterOrder(chapters, reverse, book.reverseToc === true);
}
export async function loadChapterPayload(
  source: BookSource,
  chapter: BookChapter,
  options?: AbortableSourceRunnerOptions,
): Promise<{content: string; subContent: string; variable?: string; bookVariable?: string}> {
  checkCancelled(options?.signal);
  if (chapter.isVolume) return { content: '', subContent: '' };
  const r = rule(source, 'ruleContent'),
    seenPages = new Set<string>(),
    contents: string[] = [],
    subContents: string[] = [];
  let pageUrl = chapter.url;
  let contentBaseUrl = chapter.url;
  let initialSource: unknown;
  let initialRedirect = '';
  const variables = bookVariables(chapter.variable), fallbackVariables = bookVariables(chapter.bookVariable);
  const initialVariables = variableText(variables), initialBookVariables = variableText(fallbackVariables);
  for (
    let page = 1;
    page <= 50 && pageUrl && !seenPages.has(pageUrl);
    page += 1
  ) {
    checkCancelled(options?.signal);
    seenPages.add(pageUrl);
    const response = await executeCheckedSourceRequest(
        source, buildSourcePageRequest(source, pageUrl, page), options?.signal, page === 1
          ? {baseUrl: chapter.baseUrl, variables, fallbackVariables, bookName: chapter.bookName, chapterTitle: chapter.title}
          : {baseUrl: chapter.baseUrl, variables: fallbackVariables, bookName: chapter.bookName}, options?.runJavaScript,
      ),
      context = { baseUrl: pageUrl, redirectUrl: response.url, title: chapter.title, nextChapterUrl: chapter.nextChapterUrl ?? null, chapter, variables, fallbackVariables, variableBookName: chapter.bookName, sourceUrl:source.bookSourceUrl, sourceVariables:sourceRuntimeVariables(source.bookSourceUrl) },
      main =
        typeof response.data === 'string' && !String(r.content ?? '').trim()
          ? response.data
          : (options?.runRuleJavaScript
              ? await sourceRuleTextsAsync(response.data, r.content, context, options.runRuleJavaScript, options.signal)
              : sourceRuleTexts(response.data, r.content, context))
              .filter(Boolean)
              .join('\n'),
      sub = (options?.runRuleJavaScript
        ? await sourceRuleTextsAsync(response.data, r.subContent, context, options.runRuleJavaScript, options.signal)
        : sourceRuleTexts(response.data, r.subContent, context))
        .filter(Boolean)
        .join('\n');
    if (page === 1) { initialSource = response.data; initialRedirect = response.url; }
    if (!contents.length) contentBaseUrl = response.url;
    if (main)
      contents.push(
        source.bookSourceType === 1 || source.bookSourceType === 4
          ? main
          : formatSourceChapter(main, response.url, (await loadReaderPreferences()).adaptSpecialStyle),
      );
    if (sub) {
      if (/^https?:\/\//i.test(sub.trim())) {
        const subResponse = await executeSourceRequest(
          buildSourcePageRequest(source, sub.trim()), 15000, options?.signal,
        );
        subContents.push(
          typeof subResponse.data === 'string'
            ? subResponse.data
            : JSON.stringify(subResponse.data),
        );
      } else subContents.push(sub);
    }
    const next = options?.runRuleJavaScript
      ? await sourceRuleTextAsync(response.data, r.nextContentUrl, true, context, options.runRuleJavaScript, options.signal)
      : sourceRuleText(response.data, r.nextContentUrl, true, context);
    const nextPage = next ? url(next, response.url) : '';
    pageUrl = nextPage && nextPage !== chapter.nextChapterUrl ? nextPage : '';
  }
  if (!contents.length)
    throw new SourceRuleError('正文为空', source.bookSourceName);
  checkCancelled(options?.signal);
  let content = contents.join('\n');
  const replace = String(r.replaceRegex ?? '').trim();
  if (replace) {
    content = content.split(/\r\n|\r|\n/).map(line => line.trim()).join('\n');
    // Native BookContent runs the complete replacement rule against the
    // formatted source value, before adapting images/rich HTML for the reader.
    const context = { baseUrl: chapter.url, redirectUrl: initialRedirect, src: initialSource, title: chapter.title, nextChapterUrl: chapter.nextChapterUrl ?? null, chapter, variables, fallbackVariables, variableBookName: chapter.bookName, sourceUrl:source.bookSourceUrl, sourceVariables:sourceRuntimeVariables(source.bookSourceUrl) };
    content = unescapeSourceHtml4(options?.runRuleJavaScript
      ? await sourceRuleTextAsync(content, replace, false, context, options.runRuleJavaScript, options.signal)
      : sourceRuleText(content, replace, false, context));
  }
  if (!content.trim()) throw new SourceRuleError('正文为空', source.bookSourceName);
  return {
    content: [1, 2, 4].includes(source.bookSourceType)
      ? content
      : formattedSourceToReaderContent(content, contentBaseUrl),
    subContent: subContents.join('\n').trim(),
    ...(variableText(variables) !== initialVariables ? {variable: variableText(variables)} : {}),
    ...(variableText(fallbackVariables) !== initialBookVariables ? {bookVariable: variableText(fallbackVariables)} : {}),
  };
}

export async function loadChapterContent(
  source: BookSource,
  chapter: BookChapter,
  options?: AbortableSourceRunnerOptions,
) {
  return (await loadChapterPayload(source, chapter, options)).content;
}
