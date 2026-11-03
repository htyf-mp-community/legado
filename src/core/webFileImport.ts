import {
  CachesDirectoryPath,
  downloadFile,
  unlink,
  writeFile,
} from '@dr.pogodin/react-native-fs';
import { fromByteArray } from 'react-native-quick-base64';
import { keepLocalCopy } from '@react-native-documents/picker';
import { getUnzip } from 'react-native-nitro-unzip';
import { saveResponseCookies } from '../data/sourceCookies';
import type { BookSource, SearchBook, TxtTocRule } from '../types';
import { importSupportedBook, SUPPORTED_BOOK_FILE } from './localBookImport';
import { collectArchiveBookFiles } from './remoteBookArchive';
import { buildSourcePageRequest } from './sourceRequest';

export function normalizeWebFileName(
  name: string,
  rawSuffix?: string,
  replaceExistingSuffix = true,
) {
  const suffix = rawSuffix?.trim().replace(/^\.+/, '');
  if (!suffix || !/^[a-z0-9][a-z0-9._-]{0,31}$/i.test(suffix)) return name;
  const base = name.replace(/\.+$/, '');
  if (!base) return name;
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return `${base}.${suffix}`;
  if (base.slice(dot + 1).toLowerCase() === suffix.toLowerCase()) return base;
  return `${replaceExistingSuffix ? base.slice(0, dot) : base}.${suffix}`;
}

function responseFileName(headers: Record<string, string>) {
  const value =
    Object.entries(headers).find(
      ([key]) => key.toLowerCase() === 'content-disposition',
    )?.[1] ?? '';
  const encoded = value
    .match(/filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i)?.[1]
    ?.replace(/^"|"$/g, '')
    .trim();
  const plain = value.match(/filename\s*=\s*(?:"([^"]*)"|([^;]+))/i);
  const name = encoded || plain?.[1] || plain?.[2]?.trim();
  if (!name) return '';
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

function urlFileName(url: string) {
  try {
    const name = new URL(url).pathname.split('/').pop() ?? '';
    const suffix = name.split('.').pop() ?? '';
    if (
      !name.includes('.') ||
      !/^[a-z\d]{1,5}$/i.test(suffix) ||
      /^(?:php|html)$/i.test(suffix)
    )
      return '';
    try {
      return decodeURIComponent(name);
    } catch {
      return name;
    }
  } catch {
    return '';
  }
}

export type WebFileChoice = { url: string; name: string };

/** Match the original file-source chooser: identify each file before selection. */
export async function describeWebFiles(
  source: BookSource,
  book: SearchBook,
  urls: string[],
  signal?: AbortSignal,
): Promise<WebFileChoice[]> {
  return Promise.all(
    urls.map(async rawUrl => {
      const request = buildSourcePageRequest(source, rawUrl);
      let name = urlFileName(request.url);
      if (!name) {
        const controller = new AbortController();
        const cancel = () => controller.abort();
        const timer = setTimeout(cancel, 15000);
        signal?.addEventListener('abort', cancel);
        if (signal?.aborted) cancel();
        try {
          const response = await fetch(request.url, {
            method: 'HEAD',
            headers: request.headers,
            signal: controller.signal,
          ...({ redirect: 'manual' } as RequestInit),
          });
          const disposition = response.headers.get('content-disposition') ?? '';
          const location = response.headers.get('location');
          name = responseFileName({ 'content-disposition': disposition });
          if (!name && location) {
            try {
              name = urlFileName(new URL(location, request.url).toString());
            } catch {}
          }
        } catch {
          /* A filename is optional; fall back to the book name. */
        } finally {
          clearTimeout(timer);
          signal?.removeEventListener('abort', cancel);
        }
      }
      const fallback = book.author
        ? `${book.name} 作者：${book.author}`
        : book.name;
      return {
        url: rawUrl,
        name: normalizeWebFileName(name || fallback, request.fileType, !!name),
      };
    }),
  );
}

export type PreparedWebFile = {
  files: Array<{ path: string; name: string; relative: string }>;
  importFile: (
    file: PreparedWebFile['files'][number],
    rules: TxtTocRule[],
  ) => ReturnType<typeof importSupportedBook>;
  dispose: () => Promise<void>;
};

/** The returned staging data stays alive until the selected file has been imported. */
export async function prepareWebFile(
  source: BookSource,
  book: SearchBook,
  rawUrl: string,
): Promise<PreparedWebFile> {
  const request = buildSourcePageRequest(source, rawUrl),
    token = `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    path = `${CachesDirectoryPath}/web-file-${token}`,
    directory = `${CachesDirectoryPath}/web-archive-${token}`;
  const dispose = async () => {
    for (const item of [path, directory]) {
      try {
        await unlink(item);
      } catch {
        /* absent staging files need no cleanup */
      }
    }
  };
  try {
    let headers: Record<string, string> = {};
    if (request.method === 'GET') {
      const result = await downloadFile({
        fromUrl: request.url,
        toFile: path,
        headers: request.headers,
        connectionTimeout: 15000,
        readTimeout: 60000,
        begin: info => {
          headers = info.headers ?? {};
        },
      }).promise;
      headers = { ...headers, ...result.headers };
      if (result.statusCode < 200 || result.statusCode >= 300)
        throw new Error(`HTTP ${result.statusCode}`);
    } else if (request.method === 'POST') {
      const response = await fetch(request.url, {
        method: 'POST',
        headers: request.headers,
        body: request.body,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      await writeFile(
        path,
        fromByteArray(new Uint8Array(await response.arrayBuffer())),
        'base64',
      );
    } else
      throw new Error(`Unsupported file download method: ${request.method}`);
    if (request.cookieJar) {
      const cookie = Object.entries(headers).find(
        ([key]) => key.toLowerCase() === 'set-cookie',
      )?.[1];
      if (cookie) saveResponseCookies(request.sourceId, cookie);
    }
    const discovered = urlFileName(request.url) || responseFileName(headers),
      fallback = book.author ? `${book.name} 作者：${book.author}` : book.name,
      fileName = normalizeWebFileName(
        discovered || fallback,
        request.fileType,
        !!discovered,
      ).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_');
    let files: PreparedWebFile['files'];
    if (/\.zip$/i.test(fileName)) {
      const result = await getUnzip().extract(path, directory).await();
      if (!result.success) throw new Error('无法解压 ZIP 文件');
      files = await collectArchiveBookFiles(directory);
      if (!files.length) throw new Error('压缩包中没有支持的书籍');
    } else if (SUPPORTED_BOOK_FILE.test(fileName)) {
      files = [{ path, name: fileName, relative: fileName }];
    } else throw new Error(`暂不支持导入此文件：${fileName}`);
    return {
      files,
      importFile: async (file, rules) => {
        if (!files.includes(file)) throw new Error('无效的文件选择');
        // EPUB/MOBI importers retain the original URI, so it must outlive staging.
        const [copy] = await keepLocalCopy({
          files: [
            {
              uri: `file://${file.path}`,
              fileName: `legado-txt-${token}-${file.name}`,
            },
          ],
          destination: 'documentDirectory',
        });
        if (!copy || copy.status === 'error')
          throw new Error(copy?.copyError ?? '无法保存书籍文件');
        try {
          const imported = await importSupportedBook(
            copy.localUri,
            file.name,
            rules,
          );
          return {
            ...imported,
            name: book.name.trim() ? book.name : imported.name,
            author: book.author.trim() ? book.author : imported.author,
            coverUrl: book.coverUrl,
            intro: book.intro?.trim() ? book.intro : imported.intro,
          };
        } catch (error) {
          try {
            await unlink(
              decodeURIComponent(copy.localUri.replace(/^file:\/\//, '')),
            );
          } catch {}
          throw error;
        }
      },
      dispose,
    };
  } catch (error) {
    await dispose();
    throw error;
  }
}
