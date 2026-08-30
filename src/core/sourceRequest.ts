import type { BookSource } from '../types';
import { SourceRuleError, UnsupportedRuleError } from './errors';
import { saveResponseCookies, sourceCookieHeader } from '../data/sourceCookies';
import { loadGeneralPreferences } from '../data/generalPreferences';
import { addHttpLog } from '../data/httpLog';
import { addAppLog } from '../data/appLog';
import iconv from 'iconv-lite';
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
  try {
    const target = new URL(value);
    return target.protocol === 'http:'
      ? target.toString().replace(/^http:/i, 'https:')
      : target.toString();
  } catch {
    return value;
  }
}
const absolute = (value: string, base: string) => {
  try {
    return new URL(value, base).toString();
  } catch {
    throw new SourceRuleError(`无效地址: ${value}`);
  }
};
const cacheBypassUrl = (value: string) => {
  try {
    const target = new URL(value);
    target.searchParams.set('_htyf_retry', String(Date.now()));
    return target.toString();
  } catch {
    return value;
  }
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
  const compact = rule.trim();
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
const percentEncode = (value: string, charset: string) =>
  [...iconv.encode(value, charset)]
    .map(byte =>
      (byte >= 0x41 && byte <= 0x5a) ||
      (byte >= 0x61 && byte <= 0x7a) ||
      (byte >= 0x30 && byte <= 0x39) ||
      byte === 0x2d ||
      byte === 0x2e ||
      byte === 0x5f ||
      byte === 0x7e
        ? String.fromCharCode(byte)
        : `%${byte.toString(16).toUpperCase().padStart(2, '0')}`,
    )
    .join('');
const encodeFormBody = (value: string, charset: string) =>
  value
    .split('&')
    .map(field => {
      const separator = field.indexOf('='),
        name = separator < 0 ? field : field.slice(0, separator),
        content = separator < 0 ? '' : field.slice(separator + 1);
      return separator < 0
        ? percentEncode(name, charset)
        : `${percentEncode(name, charset)}=${percentEncode(content, charset)}`;
    })
    .join('&');
export function buildSourceRequest(
  source: BookSource,
  rule: string,
  key = '',
  page = 1,
): SourceRequest {
  if (!rule.trim())
    throw new SourceRuleError('请求地址为空', source.bookSourceName);
  const safeRule = unwrapSafeUrlScript(rule, source.bookSourceUrl, key, page);
  if (safeRule.includes('@js') || safeRule.includes('<js>'))
    throw new UnsupportedRuleError('JavaScript URL', source.bookSourceName);
  const [urlPart, optionPart] = splitRule(safeRule),
    url = absolute(
      replaceVars(urlPart.trim(), key, page),
      source.bookSourceUrl,
    );
  let option: Record<string, unknown> = {};
  if (optionPart) {
    try {
      option = replaceDeep(
        parseRequestOptions(optionPart),
        key,
        page,
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
  const charset = String(option.charset ?? '').trim();
  if (charset && !iconv.encodingExists(charset))
    throw new SourceRuleError(
      `不支持的字符集: ${charset}`,
      source.bookSourceName,
    );
  const body =
    rawBody && charset && typeof option.body === 'string'
      ? encodeFormBody(rawBody, charset)
      : rawBody;
  if (
    body &&
    !Object.keys(headers).some(x => x.toLowerCase() === 'content-type')
  )
    headers['Content-Type'] =
      typeof option.body === 'string'
        ? `application/x-www-form-urlencoded; charset=${charset || 'UTF-8'}`
        : 'application/json';
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
export async function executeSourceRequest(
  request: SourceRequest,
  timeout = 15000,
) {
  const controller = new AbortController(),
    started = Date.now(),
    timer = setTimeout(() => controller.abort(), timeout);
  let recorded = false;
  try {
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
    if (!response.ok && preferredUrl !== request.url && !controller.signal.aborted)
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
      addAppLog(`[source-request] retry cached 404 url=${response.url || request.url} retryUrl=${retryUrl}`);
      response = await fetch(retryUrl, {
        ...options,
        headers: {
          ...request.headers,
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      });
      addAppLog(`[source-request] retry complete status=${response.status} url=${response.url || retryUrl}`);
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
    const text = request.charset
      ? iconv.decode(
          new Uint8Array(await response.arrayBuffer()),
          request.charset,
        )
      : await response.text();
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
  }
}
