import type { BookSource } from '../types';
import { SourceHttpError, SourceRuleError, UnsupportedRuleError } from './errors';
import { saveResponseCookies, sourceCookieHeader } from '../data/sourceCookies';
import { loadGeneralPreferences } from '../data/generalPreferences';
import { addHttpLog } from '../data/httpLog';
import { addAppLog } from '../data/appLog';
import { canEncodeSourceCharset } from './sourceCharsetAvailability';
import { checkCancelled } from './cancellation';
import { resolveNativeSourceUrl, trimSourceWhitespace } from './nativeSourceUrl';
import { encodeSourceParams } from './sourceUrlEncoding';
import { decodeSourceResponse } from './sourceResponse';
import { restoredSourceLoginHeaders } from '../data/runtimeSourceCache';
import { runSourceJavaScript, runSourceJavaScriptAsync, type SourceJavaScriptBridge, type SourceJavaScriptRunner } from './sourceJavaScript';
export type SourceRequest = {
  url: string;
  method: 'GET' | 'POST' | 'HEAD';
  headers: Record<string, string>;
  body?: string;
  sourceId: string;
  cookieJar: boolean;
  charset?: string;
  fileType?: string;
  retry?: number;
  concurrentRate?: string;
  /** Header names supplied by restored login state, redacted from diagnostics. */
  sensitiveHeaderNames?: string[];
  /** Jsoup-style script POSTs must expose redirects and never be retried implicitly. */
  scriptPost?: boolean;
};
const diagnosticHeaders = (request: SourceRequest) => {
  const sensitive = new Set(
    request.sensitiveHeaderNames?.map(name => name.toLowerCase()) ?? [],
  );
  return Object.fromEntries(
    Object.entries(request.headers).map(([name, value]) => [
      name,
      sensitive.has(name.toLowerCase()) ? '[REDACTED]' : value,
    ]),
  );
};
export function mergeRequestCookies(stored: string, explicit: string) {
  const values = new Map<string, string>();
  for (const pair of `${stored};${explicit}`.split(';')) {
    const index = pair.indexOf('=');
    if (index < 1) continue;
    const name = pair.slice(0, index).trim(), value = pair.slice(index + 1).trim();
    if (name && value) values.set(name, value);
  }
  return [...values].map(([name, value]) => `${name}=${value}`).join('; ');
}
export function preferredSourceTransportUrl(value: string) {
  return value.replace(/^http:/i, 'https:');
}
const cacheBypassUrl = (value: string) => {
  const hash = value.indexOf('#'), fragment = hash < 0 ? '' : value.slice(hash), target = hash < 0 ? value : value.slice(0, hash);
  const question = target.indexOf('?'), path = question < 0 ? target : target.slice(0, question);
  const fields = question < 0 ? [] : target.slice(question + 1).split('&');
  let found = false;
  const updated = fields.flatMap(field => {
    try {
      if (decodeURIComponent(field.split('=')[0].replace(/\+/g, ' ')) === '_htyf_retry') {
        if (found) return [];
        found = true; return [`_htyf_retry=${Date.now()}`];
      }
    } catch { /* Preserve malformed legacy query fields. */ }
    return [field];
  });
  if (!found) updated.push(`_htyf_retry=${Date.now()}`);
  return `${path}?${updated.join('&')}${fragment}`;
};
const replaceVars = (value: string, key: string, page: number, baseUrl: string) => {
  let expressions = 0;
  const started = Date.now();
  return value.replace(/\{\{([\s\S]*?)\}\}|\b(searchKey|searchPage)\b/g, (_whole, expression: string | undefined, bare: string | undefined) => {
    if (bare) return bare === 'searchKey' ? key : String(page);
    const name = expression?.trim() ?? '';
    if (name === 'key' || name === 'searchKey') return key;
    if (name === 'page' || name === 'searchPage') return String(page);
    if (++expressions > 64 || Date.now() - started > 1500)
      throw new SourceRuleError('JavaScript URL 表达式超过限制');
    const result = runSourceJavaScript(name, '', { key, searchKey: key, page, searchPage: page, baseUrl });
    if (result == null) return '';
    if (!['string', 'number', 'boolean'].includes(typeof result))
      throw new SourceRuleError('JavaScript URL 表达式结果必须是文本或数字');
    return String(result);
  });
};
const replaceDeep = (value: unknown, key: string, page: number, baseUrl: string): unknown =>
  typeof value === 'string'
    ? replaceVars(value, key, page, baseUrl)
    : Array.isArray(value)
      ? value.map(x => replaceDeep(x, key, page, baseUrl))
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value).map(([k, v]) => [
              k,
              replaceDeep(v, key, page, baseUrl),
            ]),
          )
        : value;
function splitRule(rule: string) {
  const start = rule.indexOf(',{');
  return start < 0
    ? ([rule, null] as const)
    : ([rule.slice(0, start), rule.slice(start + 1)] as const);
}
function unwrapSafeUrlScript(
  rule: string,
  baseUrl: string,
  key: string,
  page: number,
) {
  const compact = trimSourceWhitespace(rule);
  if (compact.startsWith('<js>')) {
    const close = compact.indexOf('</js>');
    if (close < 0) return compact;
    const suffix = compact.slice(close + 5).trim();
    if (suffix) return suffix;
    const body = compact.slice(4, close).trim();
    const declarative = body.match(
      /^((?:https?:\/\/|\/)[^;]+,\s*\{[\s\S]*?\})\s*;/,
    );
    return declarative?.[1] ?? compact;
  }
  if (!compact.startsWith('@js:')) return compact;
  const conditionalUrl = compact.match(
    /^@js:\s*function\s+getUrl\(key\)\s*\{[\s\S]*?\/\^\\d\+\$\/\.test\(key\)[\s\S]*?if\s*\(isNumber\)\s*\{\s*return\s*`([^`]+)`\s*;?\s*\}\s*else\s*\{\s*return\s*`([^`]+)`\s*;?\s*\}\s*\}\s*getUrl\(key\)\s*;?$/,
  );
  if (conditionalUrl) {
    const selected = /^\d+$/.test(key) ? conditionalUrl[1] : conditionalUrl[2];
    return selected.replace(
      /\{\{\s*\(page\s*-\s*1\)\s*\*\s*(\d+)\s*\}\}/g,
      (_match, size: string) => String((page - 1) * Number(size)),
    );
  }
  const match = compact.match(
    /^@js:\s*url\s*=\s*baseUrl\s*\+\s*(["'])([\s\S]*?)\1\s*;\s*java\.put\(\s*(["'])url\3\s*,\s*url\s*\)\s*;\s*result\s*=\s*url\s*;?\s*$/,
  );
  if (match) return `${baseUrl.replace(/\/$/, '')}${match[2]}`;
  const assigned = compact.match(
    /^@js:\s*(?:var\s+)?url\s*=\s*(["'])([\s\S]*?)\1\s*;/,
  );
  if (assigned && /\bresult\s*=\s*url\s*;?\s*$/.test(compact))
    return assigned[2];
  return compact;
}
function parseRequestOptions(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    let converted = '';
    for (let index = 0; index < value.length; index += 1) {
      if (value[index] !== "'") {
        converted += value[index];
        continue;
      }
      let text = '';
      for (index += 1; index < value.length; index += 1) {
        const character = value[index];
        if (character === "'") break;
        if (character === '\\' && index + 1 < value.length) {
          const next = value[++index];
          text +=
            next === 'n'
              ? '\n'
              : next === 'r'
                ? '\r'
                : next === 't'
                  ? '\t'
                  : next;
        } else text += character;
      }
      if (index >= value.length) throw new Error('Unterminated string');
      converted += JSON.stringify(text);
    }
    return JSON.parse(converted) as Record<string, unknown>;
  }
}
type ResolvedSearchRule = { url: string; options: Record<string, unknown> };

/** Resolve each URL expression in a fresh script scope, as AnalyzeUrl does. */
export async function buildSourceSearchRequest(
  source: BookSource,
  rule: string,
  key: string,
  page: number,
  bridge: SourceJavaScriptBridge,
  runJavaScript: SourceJavaScriptRunner = runSourceJavaScriptAsync,
  signal?: AbortSignal,
): Promise<SourceRequest> {
  const safeRule = unwrapSafeUrlScript(rule, source.bookSourceUrl, key, page);
  if (safeRule.includes('@js') || safeRule.includes('<js>'))
    throw new UnsupportedRuleError('JavaScript URL', source.bookSourceName);
  const [urlPart, optionPart] = splitRule(safeRule);
  let expressions = 0;
  const expand = async (value: string) => {
    const pattern = /\{\{([\s\S]*?)\}\}|\b(searchKey|searchPage)\b/g;
    let result = '', offset = 0, match: RegExpExecArray | null;
    while ((match = pattern.exec(value))) {
      result += value.slice(offset, match.index);
      if (match[2]) result += match[2] === 'searchKey' ? key : String(page);
      else {
        if (++expressions > 64) throw new SourceRuleError('JavaScript URL 表达式超过限制');
        const expression = match[1].trim();
        const item = expression === 'key' || expression === 'searchKey' ? key
          : expression === 'page' || expression === 'searchPage' ? page
            : await runJavaScript(expression, bridge, undefined, signal);
        if (item != null) {
          if (!['string', 'number', 'boolean'].includes(typeof item))
            throw new SourceRuleError('JavaScript URL 表达式结果必须是文本或数字');
          result += String(item);
        }
      }
      offset = pattern.lastIndex;
    }
    return result + value.slice(offset);
  };
  const expandDeep = async (value: unknown): Promise<unknown> => {
    if (typeof value === 'string') return expand(value);
    if (Array.isArray(value)) {
      const result = [];
      for (const item of value) result.push(await expandDeep(item));
      return result;
    }
    if (value && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [name, item] of Object.entries(value)) result[name] = await expandDeep(item);
      return result;
    }
    return value;
  };
  let options: Record<string, unknown> = {};
  if (optionPart) {
    try { options = parseRequestOptions(optionPart); }
    catch { throw new SourceRuleError('URL 参数 JSON 无效', source.bookSourceName); }
  }
  const resolved: ResolvedSearchRule = {
    url: await expand(trimSourceWhitespace(urlPart)),
    options: await expandDeep(options) as Record<string, unknown>,
  };
  return buildSourceRequest(source, rule, key, page, false, true, resolved);
}
/** Build a declarative source request; non-search consumers can disable search-token substitution. */
export function buildSourceRequest(
  source: BookSource,
  rule: string,
  key = '',
  page = 1,
  interpolateSearch = true,
  includeLoginHeaders = true,
  resolved?: ResolvedSearchRule,
): SourceRequest {
  if (!trimSourceWhitespace(rule))
    throw new SourceRuleError('请求地址为空', source.bookSourceName);
  const safeRule = unwrapSafeUrlScript(rule, source.bookSourceUrl, key, page);
  if (safeRule.includes('@js') || safeRule.includes('<js>'))
    throw new UnsupportedRuleError('JavaScript URL', source.bookSourceName);
  const [urlPart, optionPart] = splitRule(safeRule);
  let url = resolveNativeSourceUrl(
      resolved ? resolved.url : interpolateSearch
        ? replaceVars(trimSourceWhitespace(urlPart), key, page, source.bookSourceUrl)
        : trimSourceWhitespace(urlPart),
      source.bookSourceUrl,
    );
  let option: Record<string, unknown> = {};
  if (resolved) option = resolved.options;
  else if (optionPart) {
    try {
      option = parseRequestOptions(optionPart);
    } catch {
      throw new SourceRuleError('URL 参数 JSON 无效', source.bookSourceName);
    }
    if (interpolateSearch)
      option = replaceDeep(option, key, page, source.bookSourceUrl) as Record<string, unknown>;
  }
  let headers: Record<string, string> = {};
  if (typeof source.header === 'string' && source.header.trim()) {
    try {
      if (source.header.includes('@js') || source.header.includes('<js>'))
        throw new UnsupportedRuleError(
          'JavaScript 请求头',
          source.bookSourceName,
        );
      headers = parseRequestOptions(source.header) as Record<string, string>;
    } catch {
      throw new SourceRuleError('请求头 JSON 无效', source.bookSourceName);
    }
  }
  const customUserAgent = loadGeneralPreferences().userAgent;
  if (
    customUserAgent &&
    !Object.keys(headers).some(header => header.toLowerCase() === 'user-agent')
  )
    headers['User-Agent'] = customUserAgent;
  const loginHeaders = includeLoginHeaders
    ? restoredSourceLoginHeaders(source.bookSourceUrl)
    : {};
  headers = { ...headers, ...loginHeaders };
  if (option.headers && typeof option.headers === 'object')
    headers = { ...headers, ...(option.headers as Record<string, string>) };
  const cookieJar = source.enabledCookieJar === true;
  const storedCookie = sourceCookieHeader(source.bookSourceUrl);
  if (storedCookie) {
    const cookieKeys = Object.keys(headers).filter(header => header.toLowerCase() === 'cookie');
    const cookieKey = cookieKeys[cookieKeys.length - 1] ?? 'Cookie';
    const explicitCookie = cookieKeys.map(name => headers[name]).join('; ');
    for (const name of cookieKeys) delete headers[name];
    headers[cookieKey] = mergeRequestCookies(storedCookie, explicitCookie);
  }
  const method = String(option.method ?? 'GET').toUpperCase();
  if (!['GET', 'POST', 'HEAD'].includes(method))
    throw new SourceRuleError(
      `不支持的请求方法: ${method}`,
      source.bookSourceName,
    );
  const rawBody =
    option.body === undefined
      ? undefined
      : typeof option.body === 'string'
        ? option.body
        : JSON.stringify(option.body);
  const charset = String(option.charset ?? '');
  if (charset && charset !== 'escape' && !canEncodeSourceCharset(charset))
    throw new SourceRuleError(
      `不支持的字符集: ${charset}`,
      source.bookSourceName,
    );
  const contentType = Object.keys(headers).find(name => name.toLowerCase() === 'content-type');
  const trimmedBody = trimSourceWhitespace(rawBody ?? '');
  const jsonBody = (trimmedBody.startsWith('{') && trimmedBody.endsWith('}')) || (trimmedBody.startsWith('[') && trimmedBody.endsWith(']'));
  const xmlBody = trimmedBody.startsWith('<') && trimmedBody.endsWith('>');
  const formBody = method === 'POST' && typeof option.body === 'string' && !jsonBody && !xmlBody && (!contentType || !headers[contentType]);
  const encodedBody = formBody ? encodeSourceParams(rawBody ?? '', charset, false) : rawBody;
  const sendsForm = method === 'POST' && ((formBody && !!encodedBody) || !trimmedBody);
  const body = sendsForm ? encodedBody ?? '' : formBody && !encodedBody ? rawBody : encodedBody;
  if (method !== 'POST') {
    const question = url.indexOf('?');
    if (question >= 0) url = `${url.slice(0, question)}?${encodeSourceParams(url.slice(question + 1), charset, true)}`;
  }
  if (
    method === 'POST' && body !== undefined &&
    !Object.keys(headers).some(x => x.toLowerCase() === 'content-type')
  )
    headers['Content-Type'] =
      sendsForm ? 'application/x-www-form-urlencoded; charset=UTF-8' : 'application/json; charset=UTF-8';
  return {
    url,
    method: method as SourceRequest['method'],
    headers,
    body,
    sourceId: source.bookSourceUrl,
    cookieJar,
    charset: charset || undefined,
    ...(typeof option.type === 'string' ? { fileType: option.type } : {}),
    ...(Number(option.retry) > 0 ? { retry: Math.min(2, Math.floor(Number(option.retry))) } : {}),
    ...(typeof source.concurrentRate === 'string' ? { concurrentRate: source.concurrentRate } : {}),
    ...(Object.keys(loginHeaders).length || storedCookie
      ? { sensitiveHeaderNames: [...Object.keys(loginHeaders), ...(storedCookie ? ['Cookie'] : [])] }
      : {}),
  };
}

/** Navigation evaluates the bounded page placeholders without rewriting literal searchKey/searchPage words. */
export function buildSourcePageRequest(source: BookSource, rule: string, page = 1, includeLoginHeaders = true): SourceRequest {
  const value = rule.replace(/\{\{\s*(?:searchPage|page)\s*\}\}/g, String(page));
  return buildSourceRequest(source, value, '', page, false, includeLoginHeaders);
}
const sourceRequestTimes = new Map<string, number[]>();
async function waitForSourceRate(request: SourceRequest, signal: AbortSignal) {
  const match = /^(\d+)\/(\d+)$/.exec(request.concurrentRate?.trim() ?? '');
  if (!match) return;
  const limit = Number(match[1]), interval = Number(match[2]);
  if (!limit || !interval || limit > 10_000 || interval > 3_600_000) return;
  while (true) {
    checkCancelled(signal);
    const now = Date.now();
    const recent = (sourceRequestTimes.get(request.sourceId) ?? []).filter(time => time + interval > now);
    sourceRequestTimes.set(request.sourceId, recent);
    if (recent.length < limit) {
      recent.push(now);
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const finish = () => { signal.removeEventListener('abort', cancel); resolve(); };
      const timer = setTimeout(finish, Math.max(1, recent[0] + interval - now));
      const cancel = () => { clearTimeout(timer); signal.removeEventListener('abort', cancel); reject(new SourceRuleError('请求已取消')); };
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) cancel();
    });
  }
}
export async function executeSourceRequest(
  request: SourceRequest,
  timeout = 15000,
  signal?: AbortSignal,
  acceptHttpErrors = false,
): Promise<{data: unknown; url: string; body?: string; code?: number; headers?: Record<string, string>}> {
  const controller = new AbortController(),
    started = Date.now(),
    timer = setTimeout(() => controller.abort(), timeout);
  const cancelled = () => controller.abort();
  signal?.addEventListener('abort', cancelled);
  if (signal?.aborted) cancelled();
  let recorded = false;
  try {
    checkCancelled(controller.signal);
    await waitForSourceRate(request, controller.signal);
    const preferredUrl = request.scriptPost ? request.url : preferredSourceTransportUrl(request.url),
      options = {
        method: request.method,
        headers: request.headers,
        body:
          request.method === 'GET' || request.method === 'HEAD'
            ? undefined
            : request.body,
        signal: controller.signal,
        ...(request.scriptPost ? {redirect:'manual' as const} : {}),
      };
    const transport: typeof fetch = request.scriptPost ? require('react-native-nitro-fetch').fetch : fetch;
    let response: Response;
    let usedHttpFallback = false;
    try {
      response = await transport(preferredUrl, options);
    } catch (error) {
      if (preferredUrl === request.url || controller.signal.aborted)
        throw error;
      response = await transport(request.url, options);
      usedHttpFallback = true;
    }
    // Older Legado collections commonly declare an HTTP origin. Prefer HTTPS
    // where the host supports it, but do not treat an HTTPS error page as the
    // source response: some legacy hosts expose HTTPS without serving the same
    // paths. The original request remains the authoritative fallback.
    if (
      !response.ok &&
      preferredUrl !== request.url &&
      !usedHttpFallback &&
      !controller.signal.aborted
    )
      response = await fetch(request.url, options);
    // Legado URL options may request retries after an HTTP error. Save each
    // response's cookies first so a site's challenge can complete on retry.
    for (let attempt = 0; !response.ok && attempt < (request.retry ?? 0) && !controller.signal.aborted; attempt += 1) {
      const cookie = request.cookieJar ? response.headers?.get?.('set-cookie') : null;
      if (cookie) saveResponseCookies(request.sourceId, cookie);
      const headers = { ...request.headers };
      if (request.cookieJar) {
        const stored = sourceCookieHeader(request.sourceId);
        const cookieKey = Object.keys(headers).find(name => name.toLowerCase() === 'cookie') ?? 'Cookie';
        if (stored) headers[cookieKey] = stored;
      }
      response = await fetch(response.url || request.url, { ...options, headers });
    }
    // NSURLSession may retain a transient 404 for chapter pages even after the
    // origin starts serving them. Retry idempotent GETs once while explicitly
    // bypassing intermediary and platform caches before treating it as final.
    if (
      !response.ok &&
      response.status === 404 &&
      request.method === 'GET' &&
      !controller.signal.aborted
    ) {
      const retryUrl = cacheBypassUrl(response.url || request.url);
      addAppLog(
        `[source-request] retry cached 404 url=${response.url || request.url} retryUrl=${retryUrl}`,
      );
      response = await fetch(retryUrl, {
        ...options,
        headers: {
          ...request.headers,
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      });
      addAppLog(
        `[source-request] retry complete status=${response.status} url=${response.url || retryUrl}`,
      );
    }
    const responseHeaders: Record<string, string> = {};
    if (typeof response.headers?.forEach === 'function')
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
    else if (response.headers && typeof response.headers === 'object')
      for (const [key, value] of Object.entries(response.headers))
        if (typeof value === 'string') responseHeaders[key] = value;
    if (request.cookieJar) {
      const setCookie =
        typeof response.headers?.get === 'function'
          ? response.headers.get('set-cookie')
          : responseHeaders['set-cookie'];
      if (setCookie) saveResponseCookies(request.sourceId, setCookie);
    }
    const contentType = response.headers?.get?.('content-type')
      ?? Object.entries(responseHeaders).find(([name]) => name.toLowerCase() === 'content-type')?.[1];
    const text = typeof response.arrayBuffer === 'function'
      ? decodeSourceResponse(new Uint8Array(await response.arrayBuffer()), contentType)
      : await response.text();
    checkCancelled(controller.signal);
    addHttpLog({
      method: request.method,
      url: response.url || request.url,
      statusCode: response.status,
      duration: Date.now() - started,
      requestHeaders: diagnosticHeaders(request),
      requestBody: request.scriptPost ? '[REDACTED]' : request.body,
      responseHeaders: request.scriptPost ? Object.fromEntries(Object.keys(responseHeaders).map(name => [name, '[REDACTED]'])) : responseHeaders,
      responseBody: request.scriptPost ? '[REDACTED]' : text,
    });
    recorded = true;
    if (!response.ok && (!acceptHttpErrors || (request.scriptPost && (response.status < 200 || response.status >= 400))))
      throw new SourceHttpError(response.status);
    try {
      return {
        data: JSON.parse(text) as unknown,
        url: response.url || request.url,
        body: text,
        code: response.status,
        ...(request.scriptPost ? {headers:responseHeaders} : {}),
      };
    } catch {
      return { data: text, url: response.url || request.url, body: text, code: response.status, ...(request.scriptPost ? {headers:responseHeaders} : {}) };
    }
  } catch (error) {
    if (!recorded)
      addHttpLog({
        method: request.method,
        url: request.url,
        statusCode: 0,
        duration: Date.now() - started,
        requestHeaders: diagnosticHeaders(request),
        requestBody: request.scriptPost ? '[REDACTED]' : request.body,
        error: error instanceof Error ? error.message : String(error),
      });
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancelled);
  }
}
