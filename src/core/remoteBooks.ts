import {
  CachesDirectoryPath,
  downloadFile,
  uploadFiles,
  unlink,
} from '@dr.pogodin/react-native-fs';
import {
  normalizeWebDavConfig,
  webDavAuthorization,
  type WebDavCredentials,
} from '../data/remoteBackup';
export const SUPPORTED_REMOTE_BOOK_FILE =
  /\.(?:txt|epub|mobi|prc|azw|zip|rar|7z)$/i;
export const IMPORTABLE_REMOTE_BOOK_FILE = /\.(?:txt|epub|mobi|prc|azw|zip)$/i;

export type RemoteBookEntry = {
  name: string;
  url: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: number;
};
export type RemoteBookSort = 'name' | 'modified';

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

export function remoteBooksRoot(configValue: WebDavCredentials) {
  const config = normalizeWebDavConfig(configValue);
  return `${config.url}${config.directory.split('/').map(encodeURIComponent).join('/')}/books/`;
}

export function parseWebDavBookList(
  xml: string,
  currentUrl: string,
  rootUrl: string,
): RemoteBookEntry[] {
  const current = new URL(currentUrl),
    root = new URL(rootUrl),
    out: RemoteBookEntry[] = [];
  for (const match of xml.matchAll(
    /<(?:(?:\w+):)?response\b[^>]*>([\s\S]*?)<\/(?:(?:\w+):)?response>/gi,
  )) {
    const block = match[1],
      href = tag(block, 'href');
    if (!href) continue;
    const url = new URL(href, current);
    if (
      url.origin !== root.origin ||
      !url.pathname.startsWith(root.pathname) ||
      url.pathname.replace(/\/+$/, '') === current.pathname.replace(/\/+$/, '')
    )
      continue;
    const isDirectory = /<(?:(?:\w+):)?collection\b/i.test(block),
      rawName = tag(block, 'displayname'),
      name =
        rawName ||
        decodeURIComponent(
          url.pathname.replace(/\/+$/, '').split('/').pop() ?? '',
        );
    if (!name || (!isDirectory && !SUPPORTED_REMOTE_BOOK_FILE.test(name)))
      continue;
    out.push({
      name,
      url: url.toString(),
      isDirectory,
      size: Math.max(0, Number(tag(block, 'getcontentlength')) || 0),
      modifiedAt: Date.parse(tag(block, 'getlastmodified')) || 0,
    });
  }
  return out;
}

export function sortRemoteBooks(
  entries: RemoteBookEntry[],
  sort: RemoteBookSort,
  ascending: boolean,
  query = '',
) {
  const key = query.trim().toLocaleLowerCase(),
    direction = ascending ? 1 : -1;
  return entries
    .filter(item => !key || item.name.toLocaleLowerCase().includes(key))
    .sort((a, b) =>
      a.isDirectory === b.isDirectory
        ? direction *
          (sort === 'modified'
            ? a.modifiedAt - b.modifiedAt
            : a.name.localeCompare(b.name, undefined, { numeric: true }))
        : a.isDirectory
          ? -1
          : 1,
    );
}

export async function listRemoteBooks(
  config: WebDavCredentials,
  url = remoteBooksRoot(config),
  fetcher: typeof fetch = fetch,
) {
  const root = remoteBooksRoot(config);
  if (url === root) {
    const directory = await fetcher(root, {
      method: 'MKCOL',
      headers: webDavAuthorization(config),
    });
    if (![200, 201, 204, 301, 302, 405].includes(directory.status))
      throw new Error(`WebDAV books HTTP ${directory.status}`);
  }
  const response = await fetcher(url, {
    method: 'PROPFIND',
    headers: { ...webDavAuthorization(config), Depth: '1' },
  });
  if (!response.ok) throw new Error(`WebDAV HTTP ${response.status}`);
  return parseWebDavBookList(await response.text(), url, root);
}

export async function downloadRemoteBook(
  config: WebDavCredentials,
  entry: RemoteBookEntry,
) {
  const safe = entry.name.replace(/[\\/:*?"<>|]/g, '_'),
    path = `${CachesDirectoryPath}/remote-${Date.now()}-${safe}`,
    task = downloadFile({
      fromUrl: entry.url,
      toFile: path,
      headers: webDavAuthorization(config),
      connectionTimeout: 15000,
      readTimeout: 60000,
    }),
    result = await task.promise;
  if (result.statusCode < 200 || result.statusCode >= 300) {
    try {
      await unlink(path);
    } catch {}
    throw new Error(`WebDAV HTTP ${result.statusCode}`);
  }
  return { uri: `file://${path}`, path };
}

export async function uploadRemoteBookFile(
  config: WebDavCredentials,
  path: string,
  fileName: string,
  mimeType = 'application/octet-stream',
) {
  const root = remoteBooksRoot(config),
    directory = await fetch(root, {
      method: 'MKCOL',
      headers: webDavAuthorization(config),
    });
  if (![200, 201, 204, 301, 302, 405].includes(directory.status))
    throw new Error(`WebDAV books HTTP ${directory.status}`);
  const safe = fileName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_'),
    task = uploadFiles({
      toUrl: `${root}${encodeURIComponent(safe)}`,
      files: [{ filename: safe, filepath: path, filetype: mimeType }],
      method: 'PUT',
      binaryStreamOnly: true,
      headers: { ...webDavAuthorization(config), 'Content-Type': mimeType },
    }),
    result = await task.promise;
  if (result.statusCode < 200 || result.statusCode >= 300)
    throw new Error(`WebDAV HTTP ${result.statusCode}`);
  return result;
}
