import { appStorage } from './storage';

const PREFIX = 'source-cookie.v1.';
type CookieMap = Record<string, string>;
const key = (sourceId: string) => `${PREFIX}${encodeURIComponent(sourceId)}`;

export function loadSourceCookies(sourceId: string): CookieMap {
  const value = appStorage.getString(key(sourceId));
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as CookieMap)
      : {};
  } catch {
    return {};
  }
}

export function sourceCookieHeader(sourceId: string) {
  return Object.entries(loadSourceCookies(sourceId))
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

export function saveResponseCookies(sourceId: string, header: string) {
  const cookies = loadSourceCookies(sourceId);
  header
    .split(/,(?=\s*[^;,=\s]+=[^;,]*)/)
    .map(item => item.trim())
    .forEach(item => {
      const [pair, ...attributes] = item.split(';'),
        separator = pair.indexOf('=');
      if (separator <= 0) return;
      const name = pair.slice(0, separator).trim(),
        value = pair.slice(separator + 1).trim(),
        expired = attributes.some(attribute => {
          const normalized = attribute.trim().toLowerCase();
          if (normalized === 'max-age=0') return true;
          if (!normalized.startsWith('expires=')) return false;
          const date = Date.parse(attribute.slice(attribute.indexOf('=') + 1));
          return Number.isFinite(date) && date <= Date.now();
        });
      if (!value || expired) delete cookies[name];
      else cookies[name] = value;
    });
  appStorage.set(key(sourceId), JSON.stringify(cookies));
}

export function saveDocumentCookies(sourceId: string, header: string) {
  const cookies = loadSourceCookies(sourceId);
  header
    .split(';')
    .map(item => item.trim())
    .filter(Boolean)
    .forEach(pair => {
      const separator = pair.indexOf('=');
      if (separator <= 0) return;
      const name = pair.slice(0, separator).trim(),
        value = pair.slice(separator + 1).trim();
      if (value) cookies[name] = value;
      else delete cookies[name];
    });
  appStorage.set(key(sourceId), JSON.stringify(cookies));
}

export function clearSourceCookies(sourceId: string) {
  appStorage.remove(key(sourceId));
}
