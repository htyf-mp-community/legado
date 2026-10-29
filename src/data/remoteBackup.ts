import { webDavBackupHref } from '../core/webDavBackupHref';
import { fromByteArray } from 'react-native-quick-base64';
import { parseBackup } from './backup';
import { appStorage } from './storage';
import type { Book } from '../types';

const CONFIG_KEY = 'remote.webdav.config.v1';
const PASSWORD_KEY = 'remote.webdav.password.v1';
const BACKUP_FILE = 'backup-htyf.json';
export type RemoteBackupEntry = {
  name: string;
  url: string;
  modifiedAt: number;
};

export type WebDavConfig = {
  url: string;
  username: string;
  directory: string;
};
export type WebDavCredentials = WebDavConfig & { password: string };

export function normalizeWebDavConfig(
  value: Partial<WebDavCredentials>,
): WebDavCredentials {
  const url = value.url?.trim() ?? '';
  if (!/^https?:\/\//i.test(url))
    throw new Error('WebDAV 地址必须使用 HTTP 或 HTTPS');
  return {
    url: url.replace(/\/+$/, '') + '/',
    username: value.username?.trim() ?? '',
    password: value.password ?? '',
    directory:
      value.directory?.trim().split('/').filter(Boolean).join('/') || 'legado',
  };
}

export function loadWebDavConfig(): WebDavCredentials {
  let config: WebDavConfig = { url: '', username: '', directory: 'legado' };
  const raw = appStorage.getString(CONFIG_KEY);
  if (raw) {
    try {
      config = { ...config, ...(JSON.parse(raw) as WebDavConfig) };
    } catch {}
  }
  return { ...config, password: appStorage.getString(PASSWORD_KEY) ?? '' };
}

export function saveWebDavConfig(value: WebDavCredentials) {
  const config = normalizeWebDavConfig(value);
  appStorage.set(
    CONFIG_KEY,
    JSON.stringify({
      url: config.url,
      username: config.username,
      directory: config.directory,
    }),
  );
  appStorage.set(PASSWORD_KEY, config.password);
  return config;
}

function utf8Bytes(value: string) {
  const encoded = encodeURIComponent(value);
  const bytes: number[] = [];
  for (let index = 0; index < encoded.length; index += 1) {
    if (encoded[index] === '%') {
      bytes.push(Number.parseInt(encoded.slice(index + 1, index + 3), 16));
      index += 2;
    } else bytes.push(encoded.charCodeAt(index));
  }
  return Uint8Array.from(bytes);
}

export function webDavAuthorization(
  config: WebDavCredentials,
): Record<string, string> {
  if (!config.username && !config.password) return {};
  const encoded = fromByteArray(
    utf8Bytes(`${config.username}:${config.password}`),
  );
  return { Authorization: `Basic ${encoded}` };
}

export function webDavBackupUrl(value: WebDavCredentials) {
  const config = normalizeWebDavConfig(value);
  return `${config.url}${config.directory
    .split('/')
    .map(encodeURIComponent)
    .join('/')}/${BACKUP_FILE}`;
}

async function request(
  configValue: WebDavCredentials,
  url: string,
  init: RequestInit,
  timeout = 15000,
) {
  const config = normalizeWebDavConfig(configValue);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        ...webDavAuthorization(config),
        ...(init.headers as Record<string, string> | undefined),
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`WebDAV HTTP ${response.status}`);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export async function ensureWebDavDirectory(configValue: WebDavCredentials) {
  const config = normalizeWebDavConfig(configValue);
  let url = config.url;
  for (const segment of config.directory.split('/')) {
    url += `${encodeURIComponent(segment)}/`;
    const response = await fetch(url, {
      method: 'MKCOL',
      headers: webDavAuthorization(config),
    });
    if (![200, 201, 204, 301, 302, 405].includes(response.status))
      throw new Error(`WebDAV 无法创建目录: HTTP ${response.status}`);
  }
}

export async function testWebDav(config: WebDavCredentials) {
  await request(config, normalizeWebDavConfig(config).url, {
    method: 'PROPFIND',
    headers: { Depth: '0' },
  });
}

export async function uploadWebDavBackup(
  config: WebDavCredentials,
  backup: string,
  fileName = BACKUP_FILE,
) {
  parseBackup(backup);
  await ensureWebDavDirectory(config);
  const base = webDavBackupUrl(config).replace(/[^/]+$/, ''),
    safe = fileName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_');
  await request(config, `${base}${encodeURIComponent(safe)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: backup,
  });
}

const decodeXml = (value: string) =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
const tag = (xml: string, name: string) =>
  decodeXml(
    xml
      .match(
        new RegExp(
          `<(?:(?:\\w+):)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${name}>`,
          'i',
        ),
      )?.[1]
      ?.replace(/<[^>]+>/g, '')
      .trim() ?? '',
  );
export function parseWebDavBackupList(
  xml: string,
  rootUrl: string,
): RemoteBackupEntry[] {
  const root = new URL(rootUrl),
    out: RemoteBackupEntry[] = [];
  for (const match of xml.matchAll(
    /<(?:(?:\w+):)?response\b[^>]*>([\s\S]*?)<\/(?:(?:\w+):)?response>/gi,
  )) {
    const block = match[1],
      href = tag(block, 'href');
    if (!href || /<(?:(?:\w+):)?collection\b/i.test(block)) continue;
    const url = webDavBackupHref(href, rootUrl),
      name =
        tag(block, 'displayname') ||
        decodeURIComponent(url.pathname.split('/').pop() ?? '');
    if (
      url.origin !== root.origin ||
      !url.pathname.startsWith(root.pathname) ||
      !/^backup(?:-htyf.*|\d{4}-\d{2}-\d{2}.*)?\.(?:json|zip)$/i.test(name)
    )
      continue;
    out.push({
      name,
      url: url.toString(),
      modifiedAt: Date.parse(tag(block, 'getlastmodified')) || 0,
    });
  }
  return out.sort((a, b) => b.modifiedAt - a.modifiedAt);
}
export async function listWebDavBackups(configValue: WebDavCredentials) {
  const config = normalizeWebDavConfig(configValue);
  await ensureWebDavDirectory(config);
  const root = webDavBackupUrl(config).replace(/[^/]+$/, ''),
    response = await request(config, root, {
      method: 'PROPFIND',
      headers: { Depth: '1' },
    });
  return parseWebDavBackupList(await response.text(), root);
}
export async function downloadWebDavBackupEntry(
  config: WebDavCredentials,
  entry: RemoteBackupEntry,
) {
  const response = await request(config, entry.url, { method: 'GET' }),
    backup = await response.text();
  parseBackup(backup);
  return backup;
}

export async function downloadWebDavBackup(config: WebDavCredentials) {
  const response = await request(config, webDavBackupUrl(config), {
    method: 'GET',
  });
  const backup = await response.text();
  parseBackup(backup);
  return backup;
}

export type RemoteBookProgress = {
  name: string;
  author: string;
  durChapterIndex: number;
  durChapterPos: number;
  durChapterTime: number;
  durChapterTitle?: string;
};

const progressName = (book: Pick<Book, 'name' | 'author'>) =>
  `${book.name}_${book.author}`
    .normalize('NFC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .trim() + '.json';

export function webDavBookProgressUrl(
  value: WebDavCredentials,
  book: Pick<Book, 'name' | 'author'>,
) {
  const config = normalizeWebDavConfig(value),
    root = `${config.url}${config.directory
      .split('/')
      .map(encodeURIComponent)
      .join('/')}/bookProgress/`;
  return `${root}${encodeURIComponent(progressName(book))}`;
}

export async function uploadWebDavBookProgress(
  configValue: WebDavCredentials,
  book: Book,
) {
  const config = normalizeWebDavConfig(configValue);
  await ensureWebDavDirectory(config);
  const directoryUrl = webDavBookProgressUrl(config, book).replace(
      /[^/]+$/,
      '',
    ),
    directory = await fetch(directoryUrl, {
      method: 'MKCOL',
      headers: webDavAuthorization(config),
    });
  if (![200, 201, 204, 301, 302, 405].includes(directory.status))
    throw new Error(`WebDAV 无法创建阅读进度目录: HTTP ${directory.status}`);
  const index = Math.max(0, book.currentChapterIndex ?? 0),
    progress: RemoteBookProgress = {
      name: book.name,
      author: book.author,
      durChapterIndex: index,
      durChapterPos:
        book.readingPosition &&
        book.readingPosition.chapterId === book.chapters?.[index]?.id
          ? Math.max(0, Math.trunc(book.readingPosition.position))
          : 0,
      durChapterTime: Date.now(),
      durChapterTitle: book.chapters?.[index]?.title ?? book.chapterTitle,
    };
  await request(config, webDavBookProgressUrl(config, book), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(progress),
  });
  return progress;
}

export async function downloadWebDavBookProgress(
  configValue: WebDavCredentials,
  book: Pick<Book, 'name' | 'author'>,
) {
  const config = normalizeWebDavConfig(configValue),
    response = await fetch(webDavBookProgressUrl(config, book), {
      method: 'GET',
      headers: webDavAuthorization(config),
    });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`WebDAV HTTP ${response.status}`);
  const value = (await response.json()) as Partial<RemoteBookProgress>;
  if (
    value.name !== book.name ||
    value.author !== book.author ||
    !Number.isInteger(value.durChapterIndex) ||
    Number(value.durChapterIndex) < 0
  )
    throw new Error('INVALID_BOOK_PROGRESS');
  return {
    name: value.name,
    author: value.author,
    durChapterIndex: Number(value.durChapterIndex),
    durChapterPos: Math.max(0, Number(value.durChapterPos) || 0),
    durChapterTime: Math.max(0, Number(value.durChapterTime) || 0),
    durChapterTitle:
      typeof value.durChapterTitle === 'string'
        ? value.durChapterTitle
        : undefined,
  } satisfies RemoteBookProgress;
}
