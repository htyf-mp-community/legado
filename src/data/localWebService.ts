import { LOCAL_WEB_PAGE } from '../core/localWebPage';
import { webBookCover } from '../services/webBookCover';
import { applyBookshelfRefresh } from '../core/bookshelfRefresh';
import {
  localServerState,
  startLocalServer,
  stopLocalServer,
} from '../services/localServerRuntime';
import {
  type HttpResponse,
  type RequestHandler,
} from 'react-native-nitro-http-server';
import type { Book } from '../types';
import { loadLibrary, normalizeBook, updateLibrary } from './library';
import {
  loadSources,
  mergeBookSources,
  parseBookSources,
  saveSources,
} from './sources';
import {
  loadRssSources,
  mergeRssSources,
  parseRssSources,
  saveRssSources,
} from './rss';
import {
  applyReplaceRules,
  loadReplaceRules,
  mergeReplaceRules,
  parseReplaceRules,
  saveReplaceRules,
} from './replaceRules';
import { httpLogDetail, loadHttpLogs } from './httpLog';
import { appStorage } from './storage';
import {
  CachesDirectoryPath,
  unlink,
  writeFile,
} from '@dr.pogodin/react-native-fs';
import { fromByteArray } from 'react-native-quick-base64';
import {
  importSupportedBook,
  SUPPORTED_BOOK_FILE,
} from '../core/localBookImport';
import { loadTxtTocRules } from './txtTocRules';
import { sourceCookieHeader } from './sourceCookies';
import { loadChapters } from '../core/webBook';
import {
  loadChapterReviewPage,
  loadReviewReplies,
  loadReviewSummaries,
  type ChapterReviewSummary,
} from '../core/chapterReviews';

const CONFIG_KEY = 'local-web-service.config.v1';
const WEB_READER_CONFIG_KEY = 'local-web-service.reader-config.v1';
const DEFAULT_PORT = 1122;
const MAX_WEB_UPLOAD_BYTES = 100 * 1024 * 1024;
const MAX_PROXY_BYTES = 25 * 1024 * 1024;

export type LocalWebServiceConfig = { port: number; token: string };
export type LocalWebServiceStatus = {
  running: boolean;
  port: number;
  url: string;
};

export function loadLocalWebServiceConfig(): LocalWebServiceConfig {
  const raw = appStorage.getString(CONFIG_KEY);
  if (raw) {
    try {
      const value = JSON.parse(raw) as Partial<LocalWebServiceConfig>;
      return {
        port: normalizePort(value.port),
        token: String(value.token ?? ''),
      };
    } catch {}
  }
  return { port: DEFAULT_PORT, token: '' };
}

export function saveLocalWebServiceConfig(value: LocalWebServiceConfig) {
  const normalized = {
    port: normalizePort(value.port),
    token: value.token.trim(),
  };
  appStorage.set(CONFIG_KEY, JSON.stringify(normalized));
  return normalized;
}

export function normalizePort(value: unknown): number {
  const port = Number(value);
  return Number.isInteger(port) && port >= 1024 && port <= 65535
    ? port
    : DEFAULT_PORT;
}

function json(body: unknown, status = 200): HttpResponse {
  return {
    statusCode: status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers':
        'content-type, x-legado-token, x-upload-filename',
    },
    body: JSON.stringify(body),
  };
}

function html(body: string): HttpResponse {
  return {
    statusCode: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-content-type-options': 'nosniff',
    },
    body,
  };
}

function success(data: unknown = '') {
  return json({ isSuccess: true, data });
}
function failure(errorMsg: string, status = 400) {
  return json({ isSuccess: false, errorMsg }, status);
}

function safeFileName(value: string) {
  const name =
    decodeURIComponent(value)
      .split(/[\\/]/)
      .pop()
      ?.replace(/[\u0000-\u001f]/g, '')
      .trim() ?? '';
  if (!name || name === '.' || name === '..' || !SUPPORTED_BOOK_FILE.test(name))
    throw new Error('Unsupported or unsafe ebook filename');
  return name;
}

async function proxyImage(url: URL, books: Book[]): Promise<HttpResponse> {
  const path = url.searchParams.get('path') ?? '';
  let target: URL;
  try {
    target = new URL(path);
  } catch {
    return failure('Invalid image URL');
  }
  if (!['http:', 'https:'].includes(target.protocol))
    return failure('Only HTTP(S) images can be proxied');
  const book = findBook(books, url),
    source = book?.origin
      ? (await loadSources()).find(item => item.bookSourceUrl === book.origin)
      : undefined;
  let headers: Record<string, string> = {};
  if (source && typeof source.header === 'string') {
    try {
      headers = JSON.parse(source.header) as Record<string, string>;
    } catch {}
  }
  if (source?.enabledCookieJar) {
    const cookie = sourceCookieHeader(source.bookSourceUrl);
    if (cookie) headers.Cookie = cookie;
  }
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(target.toString(), {
        headers,
        signal: controller.signal,
      }),
      length = Number(response.headers.get('content-length') ?? 0);
    if (!response.ok) return failure(`Image HTTP ${response.status}`, 502);
    if (length > MAX_PROXY_BYTES) return failure('Image is too large', 413);
    const body = await response.arrayBuffer();
    if (body.byteLength > MAX_PROXY_BYTES)
      return failure('Image is too large', 413);
    return {
      statusCode: 200,
      headers: {
        'content-type':
          response.headers.get('content-type') ?? 'application/octet-stream',
        'cache-control': 'private, max-age=3600',
        'x-content-type-options': 'nosniff',
      },
      body,
    };
  } catch (error) {
    return failure(error instanceof Error ? error.message : String(error), 502);
  } finally {
    clearTimeout(timer);
  }
}

function postData(request: Parameters<RequestHandler>[0], url: URL): string {
  if (!request.body) return url.searchParams.get('postData') ?? '';
  const contentType =
    request.headers['content-type'] ?? request.headers['Content-Type'] ?? '';
  if (contentType.includes('application/x-www-form-urlencoded'))
    return new URLSearchParams(request.body).get('postData') ?? '';
  try {
    const body = JSON.parse(request.body) as unknown;
    if (body && typeof body === 'object' && 'postData' in body)
      return String((body as { postData?: unknown }).postData ?? '');
  } catch {}
  return request.body;
}

function parseRecord(raw: string): Record<string, unknown> {
  const value = JSON.parse(raw) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected an object');
  return value as Record<string, unknown>;
}

function findBook(books: Book[], url: URL) {
  const id =
    url.searchParams.get('id') ??
    url.searchParams.get('url') ??
    url.searchParams.get('bookUrl');
  return books.find(book => book.id === id || book.bookUrl === id);
}

export function createLocalWebServiceHandler(
  config: LocalWebServiceConfig,
): RequestHandler {
  return async request => {
    if (request.method === 'OPTIONS') return json({ ok: true });
    const url = new URL(request.path, `http://127.0.0.1:${config.port}`);
    if (request.method === 'GET' && url.pathname === '/')
      return html(LOCAL_WEB_PAGE);
    if (
      config.token &&
      Object.entries(request.headers).find(
        ([name]) => name.toLowerCase() === 'x-legado-token',
      )?.[1] !== config.token &&
      url.searchParams.get('token') !== config.token
    ) {
      return json({ isSuccess: false, errorMsg: 'Unauthorized' }, 401);
    }
    const books = await loadLibrary();
    if (request.method === 'GET' && url.pathname === '/cover')
      return webBookCover(url, books);
    if (request.method === 'GET' && url.pathname === '/image')
      return proxyImage(url, books);
    if (request.method === 'GET' && url.pathname === '/getBookshelf') {
      return success(books);
    }
    if (request.method === 'GET' && url.pathname === '/getBookSources')
      return success(await loadSources());
    if (request.method === 'GET' && url.pathname === '/getBookSource')
      return success(
        (await loadSources()).find(
          item =>
            item.bookSourceUrl ===
            (url.searchParams.get('url') ??
              url.searchParams.get('bookSourceUrl')),
        ) ?? null,
      );
    if (
      request.method === 'GET' &&
      url.pathname === '/getJsSourceApiTokenRequired'
    )
      return success(Boolean(config.token));
    if (request.method === 'GET' && url.pathname === '/getRssSources')
      return success(loadRssSources());
    if (request.method === 'GET' && url.pathname === '/getRssSource')
      return success(
        loadRssSources().find(
          item =>
            item.sourceUrl ===
            (url.searchParams.get('url') ?? url.searchParams.get('sourceUrl')),
        ) ?? null,
      );
    if (request.method === 'GET' && url.pathname === '/getReplaceRules')
      return success(JSON.stringify(loadReplaceRules()));
    if (request.method === 'GET' && url.pathname === '/getHttpLogs')
      return success(loadHttpLogs());
    if (request.method === 'GET' && url.pathname === '/getHttpLog') {
      const item = loadHttpLogs().find(
        value => value.id === url.searchParams.get('id'),
      );
      return success(item ? { ...item, detail: httpLogDetail(item) } : null);
    }
    if (request.method === 'GET' && url.pathname === '/getReadConfig') {
      const value = appStorage.getString(WEB_READER_CONFIG_KEY);
      return value === undefined
        ? failure('No configuration', 404)
        : success(value);
    }
    const book = findBook(books, url);
    if (request.method === 'GET' && url.pathname === '/getChapterList') {
      return book
        ? success(book.chapters ?? [])
        : failure('Book not found', 404);
    }
    if (request.method === 'GET' && url.pathname === '/getBookContent') {
      if (!book) return failure('Book not found', 404);
      const index = Math.max(
        0,
        Math.min(
          (book.chapters?.length ?? 1) - 1,
          Number(
            url.searchParams.get('index') ?? book.currentChapterIndex ?? 0,
          ),
        ),
      );
      return success(book.chapters?.[index]?.content ?? book.content);
    }
    if (request.method === 'GET' && url.pathname === '/refreshToc') {
      if (!book || !book.origin || !book.bookUrl)
        return failure('Book or source not found', 404);
      const source = (await loadSources()).find(
        item => item.bookSourceUrl === book.origin,
      );
      if (!source) return failure('Book source not found', 404);
      try {
        const incoming = await loadChapters(source, {
          name: book.name,
          author: book.author,
          bookUrl: book.bookUrl,
          origin: book.origin,
          originName: book.originName ?? source.bookSourceName,
          tocUrl: book.tocUrl,
          sourceType: book.sourceType,
        });
        const old = new Map(
          (book.chapters ?? []).map(chapter => [
            chapter.url ?? chapter.id,
            chapter,
          ]),
        );
        const chapters = incoming.map(chapter => ({
          id: chapter.url || `${book.id}-${chapter.index}`,
          title: chapter.title,
          content: old.get(chapter.url)?.content ?? '',
          url: chapter.url,
          baseUrl: chapter.baseUrl,
          isVolume: chapter.isVolume,
          isVip: chapter.isVip,
          isPay: chapter.isPay,
          tag: chapter.tag,
          wordCount: chapter.wordCount,
        }));
        const next = normalizeBook({
          ...book,
          chapters,
          updatedAt: Date.now(),
        });
        await updateLibrary(current =>
          applyBookshelfRefresh(current, [book], [next]),
        );
        return success(chapters);
      } catch (error) {
        return failure(
          error instanceof Error ? error.message : String(error),
          502,
        );
      }
    }
    if (
      request.method === 'GET' &&
      ['/getReviewSummary', '/getReviewDetail', '/getReviewReplies'].includes(
        url.pathname,
      )
    ) {
      if (!book || !book.origin) return failure('Book not found', 404);
      const source = (await loadSources()).find(
          item => item.bookSourceUrl === book.origin,
        ),
        index = Math.max(
          0,
          Math.min(
            (book.chapters?.length ?? 1) - 1,
            Number(
              url.searchParams.get('chapterIndex') ??
                url.searchParams.get('index') ??
                book.currentChapterIndex ??
                0,
            ),
          ),
        ),
        chapter = book.chapters?.[index];
      if (!source || !chapter)
        return failure('Source or chapter not found', 404);
      try {
        if (url.pathname === '/getReviewSummary')
          return success(await loadReviewSummaries(source, book, chapter));
        const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
        if (url.pathname === '/getReviewReplies')
          return success(
            await loadReviewReplies(
              source,
              book,
              chapter,
              url.searchParams.get('reviewId') ??
                url.searchParams.get('id') ??
                '',
              page,
            ),
          );
        const summary: ChapterReviewSummary = {
          paragraphIndex: Number(url.searchParams.get('paragraphIndex') ?? -1),
          count: Number(url.searchParams.get('count') ?? 0),
          data: url.searchParams.get('paragraphData') ?? undefined,
        };
        return success(
          await loadChapterReviewPage(source, book, chapter, page, summary),
        );
      } catch (error) {
        return failure(
          error instanceof Error ? error.message : String(error),
          502,
        );
      }
    }
    const raw = postData(request, url);
    if (request.method === 'POST' && url.pathname === '/addLocalBook') {
      const fileNameValue =
        url.searchParams.get('fileName') ??
        request.headers['x-file-name'] ??
        '';
      try {
        const fileName = safeFileName(fileNameValue),
          bytes = request.binaryBody
            ? new Uint8Array(request.binaryBody)
            : new Uint8Array();
        if (!bytes.byteLength || bytes.byteLength > MAX_WEB_UPLOAD_BYTES)
          return failure('Upload is empty or too large', 413);
        const path = `${CachesDirectoryPath}/legado-web-${Date.now()}-${fileName}`;
        try {
          await writeFile(path, fromByteArray(bytes), 'base64');
          const imported = await importSupportedBook(
              `file://${path}`,
              fileName,
              loadTxtTocRules(),
            ),
            id = imported.id;
          await updateLibrary(current => [
            ...current.filter(item => item.id !== id),
            imported,
          ]);
          return success(imported);
        } finally {
          try {
            await unlink(path);
          } catch {}
        }
      } catch (error) {
        return failure(error instanceof Error ? error.message : String(error));
      }
    }
    if (request.method === 'POST' && url.pathname === '/saveBook') {
      try {
        const value = normalizeBook(parseRecord(raw) as unknown as Book);
        await updateLibrary(current => [
          ...current.filter(item => item.id !== value.id),
          value,
        ]);
        return success(value);
      } catch (error) {
        return failure(error instanceof Error ? error.message : String(error));
      }
    }
    if (request.method === 'POST' && url.pathname === '/deleteBook') {
      try {
        const value = parseRecord(raw),
          id = String(value.id ?? value.bookUrl ?? '');
        let removed = 0;
        await updateLibrary(current => {
          const next = current.filter(
            item => item.id !== id && item.bookUrl !== id,
          );
          removed = current.length - next.length;
          return next;
        });
        return success(removed);
      } catch (error) {
        return failure(error instanceof Error ? error.message : String(error));
      }
    }
    if (
      request.method === 'POST' &&
      (url.pathname === '/saveBookSource' ||
        url.pathname === '/saveBookSources')
    ) {
      try {
        const incoming = parseBookSources(raw),
          next = mergeBookSources(await loadSources(), incoming);
        await saveSources(next);
        return success(incoming);
      } catch (error) {
        return failure(error instanceof Error ? error.message : String(error));
      }
    }
    if (request.method === 'POST' && url.pathname === '/deleteBookSources') {
      try {
        const incoming = parseBookSources(raw),
          ids = new Set(incoming.map(item => item.bookSourceUrl)),
          current = await loadSources();
        await saveSources(current.filter(item => !ids.has(item.bookSourceUrl)));
        return success(ids.size);
      } catch (error) {
        return failure(error instanceof Error ? error.message : String(error));
      }
    }
    if (
      request.method === 'POST' &&
      (url.pathname === '/saveRssSource' || url.pathname === '/saveRssSources')
    ) {
      try {
        const incoming = parseRssSources(raw),
          next = mergeRssSources(loadRssSources(), incoming);
        saveRssSources(next);
        return success(incoming);
      } catch (error) {
        return failure(error instanceof Error ? error.message : String(error));
      }
    }
    if (request.method === 'POST' && url.pathname === '/deleteRssSources') {
      try {
        const incoming = parseRssSources(raw),
          ids = new Set(incoming.map(item => item.sourceUrl));
        saveRssSources(
          loadRssSources().filter(item => !ids.has(item.sourceUrl)),
        );
        return success(ids.size);
      } catch (error) {
        return failure(error instanceof Error ? error.message : String(error));
      }
    }
    if (request.method === 'POST' && url.pathname === '/saveReplaceRule') {
      try {
        const incoming = parseReplaceRules(raw),
          next = mergeReplaceRules(loadReplaceRules(), incoming);
        saveReplaceRules(next);
        return success(incoming);
      } catch (error) {
        return failure(error instanceof Error ? error.message : String(error));
      }
    }
    if (request.method === 'POST' && url.pathname === '/deleteReplaceRule') {
      try {
        const value = parseRecord(raw),
          id = Number(value.id),
          next = loadReplaceRules().filter(item => item.id !== id);
        saveReplaceRules(next);
        return success(id);
      } catch (error) {
        return failure(error instanceof Error ? error.message : String(error));
      }
    }
    if (request.method === 'POST' && url.pathname === '/testReplaceRule') {
      try {
        const value = parseRecord(raw),
          content = String(value.text ?? value.content ?? ''),
          rules = parseReplaceRules(JSON.stringify(value.rule ?? value));
        return success(
          applyReplaceRules(content, rules, 'content', {
            name: '',
            origin: '',
          }),
        );
      } catch (error) {
        return failure(error instanceof Error ? error.message : String(error));
      }
    }
    if (request.method === 'POST' && url.pathname === '/saveReadConfig') {
      if (raw) appStorage.set(WEB_READER_CONFIG_KEY, raw);
      else appStorage.remove(WEB_READER_CONFIG_KEY);
      return success();
    }
    if (request.method === 'POST' && url.pathname === '/saveBookProgress') {
      let payload: {
        id?: string;
        bookUrl?: string;
        index?: number;
        progress?: number;
      } = {};
      try {
        payload = raw ? (parseRecord(raw) as typeof payload) : {};
      } catch {}
      const legacy = payload as typeof payload & {
        name?: string;
        author?: string;
        durChapterIndex?: number;
        durChapterPos?: number;
      };
      const target =
        book ??
        books.find(
          item =>
            item.id === payload.id ||
            item.bookUrl === payload.bookUrl ||
            (item.name === legacy.name && item.author === legacy.author),
        );
      if (!target) return failure('Book not found', 404);
      const index = Math.max(
        0,
        Math.min(
          (target.chapters?.length ?? 1) - 1,
          Number(
            payload.index ??
              legacy.durChapterIndex ??
              url.searchParams.get('index') ??
              0,
          ),
        ),
      );
      const chapter = target.chapters?.[index];
      const next = {
        ...target,
        currentChapterIndex: index,
        chapterTitle: chapter?.title ?? target.chapterTitle,
        content: chapter?.content ?? target.content,
        progress: Number(
          payload.progress ??
            legacy.durChapterPos ??
            url.searchParams.get('progress') ??
            target.progress,
        ),
        updatedAt: Date.now(),
      };
      await updateLibrary(current =>
        current.map(item =>
          item.id === target.id
            ? {
                ...item,
                currentChapterIndex: next.currentChapterIndex,
                chapterTitle: next.chapterTitle,
                content: next.content,
                progress: next.progress,
                updatedAt: next.updatedAt,
                durChapterTime: next.updatedAt,
              }
            : item,
        ),
      );
      return success(next);
    }
    // TODO(htyf-native): Review execution and source-JS endpoints remain unavailable until the documented QuickJS runtime gap is resolved.
    if (
      [
        '/saveJsSource',
        '/openLegacyReview',
        '/runLegacyReview',
        '/legacyReviewPage',
      ].includes(url.pathname)
    )
      return failure(
        'This endpoint requires the unavailable sandboxed rule JavaScript runtime',
        501,
      );
    return failure('Not found', 404);
  };
}

export async function startLocalWebService(
  config = loadLocalWebServiceConfig(),
): Promise<LocalWebServiceStatus> {
  const saved = saveLocalWebServiceConfig(config);
  const port = await startLocalServer(
    'web',
    saved.port,
    createLocalWebServiceHandler(saved),
  );
  return { running: true, port, url: `http://127.0.0.1:${port}` };
}

export async function stopLocalWebService(): Promise<LocalWebServiceStatus> {
  await stopLocalServer('web');
  const port = loadLocalWebServiceConfig().port;
  return { running: false, port, url: `http://127.0.0.1:${port}` };
}

export async function localWebServiceStatus(): Promise<LocalWebServiceStatus> {
  const state = await localServerState('web', loadLocalWebServiceConfig().port);
  return { ...state, url: `http://127.0.0.1:${state.port}` };
}
