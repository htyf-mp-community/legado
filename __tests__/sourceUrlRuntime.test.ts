jest.mock('../src/data/storage', () => ({ appStorage: { getString: jest.fn(), set: jest.fn(), remove: jest.fn() } }));
import { buildSourceRequest, executeSourceRequest } from '../src/core/sourceRequest';
import { resolveWebBookUrl, loadBookInfo, loadChapters, loadChapterPayload } from '../src/core/webBook';
import { parseMangaImages } from '../src/core/manga';
import { parseRssFeed } from '../src/core/rss';
import { parseChapterReviews } from '../src/core/chapterReviews';
import { formatSourceChapter } from '../src/core/htmlFormatter';
import type { BookSource } from '../src/types';

const runtime = require('../scripts/test-support/native-url-runtime.cjs')();
const original = { URL: globalThis.URL, URLSearchParams: globalThis.URLSearchParams };
beforeEach(() => { globalThis.URL = runtime.URL; globalThis.URLSearchParams = runtime.URLSearchParams; });
afterEach(() => { globalThis.URL = original.URL; globalThis.URLSearchParams = original.URLSearchParams; });
const source: BookSource = { bookSourceUrl: 'http://127.0.0.1:18212', bookSourceName: 'URL test', bookSourceType: 0, customOrder: 0, enabled: true, enabledExplore: false };

test('builds the actual iOS spaced search URL without embedding an absolute URL in its path', () => {
  expect(buildSourceRequest(source, `${source.bookSourceUrl}/search?q={{key}}`, 'iOS 搜索验收').url)
    .toBe('http://127.0.0.1:18212/search?q=iOS%20%E6%90%9C%E7%B4%A2%E9%AA%8C%E6%94%B6');
});

test('resolves relative book links against the response directory in the native runtime', () => {
  expect(resolveWebBookUrl('../book/1', 'http://127.0.0.1:18212/dir/search?q=x'))
    .toBe('http://127.0.0.1:18212/book/1');
});

test('uses the same native resolution for image, manga, RSS and review links', () => {
  const base = 'https://Example.test/dir/page?old=x';
  expect(formatSourceChapter('<img src="../image one.png">', base)).toContain('https://Example.test/image one.png');
  expect(parseMangaImages('<img src="../image one.png">', base)).toEqual(['https://Example.test/image one.png']);
  expect(parseRssFeed('<rss><channel><item><title>T</title><link>../article</link></item></channel></rss>',
    { sourceUrl: base, sourceName: 'RSS', enabled: true, customOrder: 0 })[0].link).toBe('https://Example.test/article');
  expect(parseChapterReviews({ ...source, ruleReview: { detailListRule: '$[*]', detailContentRule: '$.text', detailAvatarRule: '$.avatar' } },
    [{ text: 'T', avatar: '../avatar.png' }], base)[0].avatar).toBe('https://Example.test/avatar.png');
});

test('encodes form fields with native defaults while keeping JSON body strings intact', () => {
  const post = (body: string, charset?: string) => buildSourceRequest(source, `${source.bookSourceUrl}/search,${JSON.stringify({ method: 'POST', body, charset })}`);
  expect(post('q=iOS 中文&literal=%20&raw=+')).toMatchObject({ body: 'q=iOS+%E4%B8%AD%E6%96%87&literal=%20&raw=%2B', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' } });
  expect(post('q=头发 €', 'GBK')).toMatchObject({ body: 'q=%CD%B7%B7%A2+%A2%E3', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' } });
  expect(post('{"q":"iOS 中文"}')).toMatchObject({ body: '{"q":"iOS 中文"}', headers: { 'Content-Type': 'application/json; charset=UTF-8' } });
});

test('a source request encoding does not override an explicit UTF-8 response charset', async () => {
  const fetch = globalThis.fetch;
  const bytes = require('buffer').Buffer.from('{"name":"iOS 地址验收"}', 'utf8');
  globalThis.fetch = jest.fn(async () => ({ ok: true, status: 200, url: 'https://example.test/search',
    headers: { get: (name: string) => name.toLowerCase() === 'content-type' ? 'application/json; charset=UTF-8' : null, forEach: (call: (value: string, key: string) => void) => call('application/json; charset=UTF-8', 'content-type') },
    arrayBuffer: async () => new Uint8Array(bytes).buffer,
  } as unknown as Response));
  try {
    const request = buildSourceRequest(source, `${source.bookSourceUrl}/search,{"charset":"GBK"}`);
    await expect(executeSourceRequest(request)).resolves.toMatchObject({ data: { name: 'iOS 地址验收' } });
  } finally { globalThis.fetch = fetch; }
});

test('detail, TOC and chapter navigation preserve literal legacy search-token words', async () => {
  const previous = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = jest.fn(async input => {
    const url = String(input); urls.push(url);
    const value = url.includes('/toc') ? [{ title: '章', url: '/chapter?literal=searchKey' }]
      : url.includes('/book') ? { name: '书', toc: '/toc?literal=searchKey' } : { content: '正文' };
    return { ok: true, status: 200, url, headers: { get: () => null, forEach: () => {} }, text: async () => JSON.stringify(value) } as unknown as Response;
  });
  try {
    const s = { ...source, ruleBookInfo: { name: '$.name', tocUrl: '$.toc' }, ruleToc: { chapterList: '$[*]', chapterName: '$.title', chapterUrl: '$.url' }, ruleContent: { content: '$.content' } };
    const book = await loadBookInfo(s, { name: '书', author: '', origin: s.bookSourceUrl, originName: '源', bookUrl: `${s.bookSourceUrl}/book?literal=searchKey` });
    const chapters = await loadChapters(s, book); await loadChapterPayload(s, chapters[0]);
    expect(urls).toHaveLength(3); expect(urls.every(url => url.includes('literal=searchKey'))).toBe(true);
  } finally { globalThis.fetch = previous; }
});
