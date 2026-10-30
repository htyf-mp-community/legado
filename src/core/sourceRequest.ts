import type { BookSource } from '../types';
import { SourceRuleError, UnsupportedRuleError } from './errors';
import { saveResponseCookies, sourceCookieHeader } from '../data/sourceCookies';
import { loadGeneralPreferences } from '../data/generalPreferences';
import { addHttpLog } from '../data/httpLog';
import { addAppLog } from '../data/appLog';
import iconv from 'iconv-lite';
import { checkCancelled } from './cancellation';
import { resolveNativeSourceUrl, trimSourceWhitespace } from './nativeSourceUrl';
import { encodeSourceParams } from './sourceUrlEncoding';
import { decodeSourceResponse } from './sourceResponse';
export type SourceRequest = {
  url: string;
  method: 'GET' | 'POST' | 'HEAD';
  headers: Record<string, string>;
  body?: string;
  sourceId: string;
  cookieJar: boolean;
  charset?: string;
};
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
const replaceVars = (value: string, key: string, page: number) =>
  value
    .replace(/\{\{\s*(?:searchKey|key)\s*\}\}|\bsearchKey\b/g, key)
    .replace(/\{\{\s*(?:searchPage|page)\s*\}\}|\bsearchPage\b/g, String(page));
const replaceDeep = (value: unknown, key: string, page: number): unknown =>
  typeof value === 'string'
    ? replaceVars(value, key, page)
    : Array.isArray(value)
      ? value.map(x => replaceDeep(x, key, page))
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value).map(([k, v]) => [
              k,
              replaceDeep(v, key, page),
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
/** Build a declarative source request; non-search consumers can disable search-token substitution. */
export function buildSourceRequest(
  source: BookSource,
  rule: string,
  key = '',
  page = 1,
  interpolateSearch = true,
): SourceRequest {
  if (!trimSourceWhitespace(rule))
    throw new SourceRuleError('请求地址为空', source.bookSourceName);
  const safeRule = unwrapSafeUrlScript(rule, source.bookSourceUrl, key, page);
  if (safeRule.includes('@js') || safeRule.includes('<js>'))
    throw new UnsupportedRuleError('JavaScript URL', source.bookSourceName);
  const [urlPart, optionPart] = splitRule(safeRule);
  let url = resolveNativeSourceUrl(
      interpolateSearch
        ? replaceVars(trimSourceWhitespace(urlPart), key, page)
        : trimSourceWhitespace(urlPart),
      source.bookSourceUrl,
    );
  let option: Record<string, unknown> = {};
  if (optionPart) {
    try {
      option = (
        interpolateSearch
          ? replaceDeep(parseRequestOptions(optionPart), key, page)
          : parseRequestOptions(optionPart)
      ) as Record<string, unknown>;
    } catch {
      throw new SourceRuleError('URL 参数 JSON 无效', source.bookSourceName);
    }
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
  if (option.headers && typeof option.headers === 'object')
    headers = { ...headers, ...(option.headers as Record<string, string>) };
  const customUserAgent = loadGeneralPreferences().userAgent;
  if (
    customUserAgent &&
    !Object.keys(headers).some(header => header.toLowerCase() === 'user-agent')
  )
    headers['User-Agent'] = customUserAgent;
  const cookieJar = source.enabledCookieJar === true;
  if (cookieJar) {
    const stored = sourceCookieHeader(source.bookSourceUrl),
      cookieKey = Object.keys(headers).find(
        header => header.toLowerCase() === 'cookie',
      );
    if (stored)
      headers[cookieKey ?? 'Cookie'] = cookieKey
        ? `${stored}; ${headers[cookieKey]}`
        : stored;
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
  if (charset && charset !== 'escape' && !iconv.encodingExists(charset))
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
  };
}

/** Navigation evaluates the bounded page placeholders without rewriting literal searchKey/searchPage words. */
export function buildSourcePageRequest(source: BookSource, rule: string, page = 1): SourceRequest {
  const value = rule.replace(/\{\{\s*(?:searchPage|page)\s*\}\}/g, String(page));
  return buildSourceRequest(source, value, '', page, false);
}
export async function executeSourceRequest(
  request: SourceRequest,
  timeout = 15000,
  signal?: AbortSignal,
) {
  const controller = new AbortController(),
    started = Date.now(),
    timer = setTimeout(() => controller.abort(), timeout);
  const cancelled = () => controller.abort();
  signal?.addEventListener('abort', cancelled);
  if (signal?.aborted) cancelled();
  let recorded = false;
  try {
    checkCancelled(controller.signal);
    const preferredUrl = preferredSourceTransportUrl(request.url),
      options = {
        method: request.method,
        headers: request.headers,
        body:
          request.method === 'GET' || request.method === 'HEAD'
            ? undefined
            : request.body,
        signal: controller.signal,
      };
    let response: Response;
    try {
      response = await fetch(preferredUrl, options);
    } catch (error) {
      if (preferredUrl === request.url || controller.signal.aborted)
        throw error;
      response = await fetch(request.url, options);
    }
    // Older Legado collections commonly declare an HTTP origin. Prefer HTTPS
    // where the host supports it, but do not treat an HTTPS error page as the
    // source response: some legacy hosts expose HTTPS without serving the same
    // paths. The original request remains the authoritative fallback.
    if (
      !response.ok &&
      preferredUrl !== request.url &&
      !controller.signal.aborted
    )
      response = await fetch(request.url, options);
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
      requestHeaders: request.headers,
      requestBody: request.body,
      responseHeaders,
      responseBody: text,
    });
    recorded = true;
    if (!response.ok) throw new SourceRuleError(`HTTP ${response.status}`);
    try {
      return {
        data: JSON.parse(text) as unknown,
        url: response.url || request.url,
      };
    } catch {
      return { data: text, url: response.url || request.url };
    }
  } catch (error) {
    if (!recorded)
      addHttpLog({
        method: request.method,
        url: request.url,
        statusCode: 0,
        duration: Date.now() - started,
        requestHeaders: request.headers,
        requestBody: request.body,
        error: error instanceof Error ? error.message : String(error),
      });
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancelled);
  }
}
