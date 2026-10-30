type UrlParts = { scheme: string; authority?: string; path: string; query?: string; fragment?: string };
export const trimSourceWhitespace = (value: string) => value.replace(/^[\t-\r\u001c-\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+|[\t-\r\u001c-\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+$/g, '');
const javaTrim = (value: string) => value.replace(/^[\x00-\x20]+|[\x00-\x20]+$/g, '');
const serialize = (url: UrlParts) => `${url.scheme}:${url.authority ? `//${url.authority}` : ''}${url.path}${url.query === undefined ? '' : `?${url.query}`}${url.fragment === undefined ? '' : `#${url.fragment}`}`;

function validAuthority(authority: string) {
  const host = authority.slice(authority.lastIndexOf('@') + 1);
  let tail = host;
  if (host.startsWith('[')) {
    const close = host.indexOf(']');
    if (close < 0 || !host.slice(1, close).includes(':')) return false;
    tail = host.slice(close + 1);
    if (tail && !tail.startsWith(':')) return false;
  } else if (host.includes('[') || host.includes(']')) return false;
  const colon = tail.lastIndexOf(':');
  if (colon >= 0) {
    const port = tail.slice(colon + 1);
    if (port && (!/^[+-]?\d+$/.test(port) || Number(port) < -1 || Number(port) > 2147483647)) return false;
  }
  return true;
}

function mergePath(input: string) {
  let path = input;
  while (path.includes('/./')) path = path.replace('/./', '/');
  let cursor = 0;
  while (true) {
    const parent = path.indexOf('/../', cursor);
    if (parent < 0) break;
    const previous = parent > 0 ? path.lastIndexOf('/', parent - 1) : -1;
    // Retain the native handler's above-root behavior, including repeated ../.
    if (previous >= 0 && path.indexOf('/../', previous) !== 0) {
      path = path.slice(0, previous) + path.slice(parent + 3); cursor = 0;
    } else cursor = parent + 3;
  }
  while (path.endsWith('/..')) {
    const parent = path.indexOf('/..');
    const previous = parent > 0 ? path.lastIndexOf('/', parent - 1) : -1;
    if (previous < 0) break;
    path = path.slice(0, previous + 1);
  }
  if (path.startsWith('./') && path.length > 2) path = path.slice(2);
  if (path.endsWith('/.')) path = path.slice(0, -1);
  return path;
}

/** java.net.URL's context resolution keeps raw spelling and differs from WHATWG. */
function parseUrl(value: string, context?: UrlParts): UrlParts | undefined {
  let raw = javaTrim(value).replace(/^url:/i, '');
  const fragmentAt = raw.indexOf('#');
  const fragment = fragmentAt < 0 ? undefined : raw.slice(fragmentAt + 1);
  if (fragmentAt >= 0) raw = raw.slice(0, fragmentAt);
  const protocol = raw.match(/^([a-z][a-z\d+.-]*):/i)?.[1]?.toLowerCase();
  if (protocol) {
    if (!/^(?:https?|ftp|file|mailto|jrt)$/.test(protocol)) return undefined;
    raw = raw.slice(protocol.length + 1);
  } else if (!context) return undefined;
  const inherited = !!context && (!protocol || (protocol === context.scheme && context.path.startsWith('/')));
  const current: UrlParts = inherited ? { ...context! } : { scheme: protocol!, path: '' };
  current.fragment = fragment;
  const queryAt = raw.indexOf('?');
  current.query = queryAt < 0 ? undefined : raw.slice(queryAt + 1);
  let path = queryAt < 0 ? raw : raw.slice(0, queryAt), newAuthority = false;
  if (path.startsWith('//') && !path.startsWith('////')) {
    const end = path.indexOf('/', 2), authority = end < 0 ? path.slice(2) : path.slice(2, end);
    if (!validAuthority(authority)) return undefined;
    current.authority = authority;
    if (authority) current.path = '';
    path = end < 0 ? '' : path.slice(end); newAuthority = true;
  }
  if (path.startsWith('/')) current.path = path;
  else if (!path && queryAt >= 0 && inherited && !newAuthority) {
    current.path = current.path.slice(0, Math.max(0, current.path.lastIndexOf('/'))) + '/';
  } else if (path || (queryAt >= 0 && !newAuthority)) {
    const old = current.path;
    current.path = old ? old.slice(0, old.lastIndexOf('/') + 1) + path : (current.authority ? '/' : '') + path;
    if (old) current.path = mergePath(current.path);
  } else if (!newAuthority && inherited) {
    current.query = context!.query;
    if (fragment === undefined && javaTrim(value) === '') current.fragment = context!.fragment;
  }
  return current;
}

/** NetworkUtils.getAbsoluteURL(String?, String), including its invalid-base fallback. */
export function resolveNativeResourceUrl(value: string, baseUrl = ''): string {
  const trimmed = trimSourceWhitespace(value);
  if (!baseUrl) return trimmed;
  const base = parseUrl(baseUrl);
  if (!base) return trimmed;
  if (/^https?:\/\//i.test(trimmed) || /^data:.*?;base64,.*$/.exec(trimmed)?.[0] === trimmed) return trimmed;
  if (trimmed.startsWith('javascript')) return '';
  const result = parseUrl(value, base);
  return result ? serialize(result) : trimmed;
}

/** Source base strings may carry request options; parsed redirect URLs do not. */
export function resolveNativeSourceUrl(value: string, baseUrl = ''): string {
  return resolveNativeResourceUrl(value, baseUrl.split(',')[0]);
}
