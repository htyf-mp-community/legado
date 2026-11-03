jest.mock('../src/data/storage', () => ({
  appStorage: { getString: jest.fn(), set: jest.fn(), remove: jest.fn() },
}));
jest.mock('../src/core/sourceRequest', () => ({
  buildSourcePageRequest: jest.fn((_source, url) => ({ url })),
  executeSourceRequest: jest.fn(),
}));
jest.mock('../src/data/generalPreferences', () => ({
  loadGeneralPreferences: () => ({ threadCount: 2, tocCountWords: true }),
}));

import { executeSourceRequest } from '../src/core/sourceRequest';
import { finalizeChapterOrder, loadChapters, parseChapters } from '../src/core/webBook';
import type { BookSource, SearchBook } from '../src/types';
import nativeOrder from './fixtures/nativeTocOrder.json';

const request = executeSourceRequest as jest.MockedFunction<typeof executeSourceRequest>;
const source: BookSource = {
  bookSourceUrl: 'https://source.test', bookSourceName: '目录', bookSourceType: 0,
  customOrder: 0, enabled: true, enabledExplore: true,
  ruleToc: { chapterList: '$.items[*]', chapterName: '$.name', chapterUrl: '$.url' },
};
const book: SearchBook = {
  origin: source.bookSourceUrl, originName: source.bookSourceName, name: '书', author: '',
  bookUrl: 'https://source.test/book', tocUrl: 'https://source.test/toc',
};
const list = { items: [
  { name: '旧一', url: '/1' }, { name: '二', url: '/2' },
  { name: '新一', url: '/1' }, { name: '三', url: '/3' },
] };
beforeEach(() => request.mockReset());

test('matches the extracted native Kotlin ordering and URL equality corpus', () => {
  for (const item of nativeOrder.cases) {
    const chapters = item.urls.map((sourceUrl, index) => ({
      sourceUrl, url: `https://source.test/${sourceUrl}`, title: String(index), index,
      bookUrl: book.bookUrl, baseUrl: book.tocUrl!, isVolume: false, isVip: false, isPay: false,
    }));
    expect(finalizeChapterOrder(chapters, item.reverse, item.reverseToc).map(value => Number(value.title))).toEqual(item.expected);
  }
});

test('applies native ordering and chooses the native duplicate when normal or reversed', async () => {
  request.mockResolvedValue({ url: book.tocUrl!, data: list });
  expect((await loadChapters(source, book)).map(x => x.title)).toEqual(['二', '新一', '三']);
  const reversed = { ...source, ruleToc: { ...source.ruleToc, chapterList: '-$.items[*]' } };
  expect((await loadChapters(reversed, book)).map(x => x.title)).toEqual(['三', '二', '旧一']);
  expect((await loadChapters(source, { ...book, reverseToc: true })).map(x => x.title)).toEqual(['三', '新一', '二']);
  expect((await loadChapters(reversed, { ...book, reverseToc: true })).map(x => x.title)).toEqual(['旧一', '二', '三']);
  const plus = { ...source, ruleToc: { ...source.ruleToc, chapterList: '+$.items[*]' } };
  expect((await loadChapters(plus, book)).map(x => x.title)).toEqual(['二', '新一', '三']);
});

test('loads every initial next-page link in order, ignoring links on those pages', async () => {
  const pages = {
    'https://source.test/toc': { items: [{ name: '一', url: '/1' }], next: ['/p2', '/p3', '/p2'] },
    'https://source.test/p2': { items: [{ name: '二', url: '/2' }], next: ['/ignored'] },
    'https://source.test/p3': { items: [{ name: '三', url: '/3' }], next: ['/ignored'] },
  };
  request.mockImplementation(async input => ({ url: input.url, data: pages[input.url as keyof typeof pages] }));
  const paged = { ...source, ruleToc: { ...source.ruleToc, nextTocUrl: '$.next[*]' } };
  expect((await loadChapters(paged, book)).map(x => x.title)).toEqual(['一', '二', '三']);
  expect(request.mock.calls.map(call => call[0].url).sort()).toEqual(Object.keys(pages).sort());
});

test('uses native truthiness, unique missing-volume URLs and chapter word-count extraction', () => {
  const flags = { ...source, ruleToc: { ...source.ruleToc, isVolume: '$.volume', isVip: '$.vip', isPay: '$.pay', updateTime: '$.info' } };
  const data = { items: [
    { name: '卷一', volume: '1', vip: 'yes', pay: 'no', info: '分卷信息' },
    { name: '正文', url: '/chapter', volume: 'false', vip: '0.0', pay: '已购', info: '更新 1200字 完成' },
  ] };
  expect(parseChapters(flags, book, data, book.tocUrl!)).toMatchObject([
    { title: '卷一', url: '卷一0', isVolume: true, isVip: true, isPay: false, tag: '分卷信息' },
    { title: '正文', isVolume: false, isVip: false, isPay: true, tag: '更新 完成', wordCount: '1200字' },
  ]);
});

test('deduplicates by the source chapter URL rather than its resolved equivalent', async () => {
  request.mockResolvedValue({ url: book.tocUrl!, data: { items: [
    { name: '相对', url: '/1' }, { name: '绝对', url: 'https://source.test/1' },
  ] } });
  expect((await loadChapters(source, book)).map(x => x.title)).toEqual(['相对', '绝对']);
});

test('rejects an empty directory instead of reporting a successful refresh', async () => {
  request.mockResolvedValue({ url: book.tocUrl!, data: { items: [] } });
  await expect(loadChapters(source, book)).rejects.toThrow('目录为空');
});

test('uses the requested page as the missing-chapter URL after a redirect', async () => {
  request.mockResolvedValue({ url: 'https://source.test/redirected', data: { items: [{ name: '无链接' }] } });
  expect(await loadChapters(source, book)).toMatchObject([{ title: '无链接', sourceUrl: book.tocUrl, url: book.tocUrl }]);
});

test('cancels other concurrent directory requests when one page fails', async () => {
  const paged = { ...source, ruleToc: { ...source.ruleToc, nextTocUrl: '$.next[*]' } };
  let cancelled = false;
  request.mockImplementation(async (input, _timeout, signal) => {
    if (input.url === book.tocUrl) return { url: input.url, data: { items: [{ name: '一', url: '/1' }], next: ['/p2', '/p3', '/p4'] } };
    if (input.url.endsWith('/p2')) throw new Error('page failed');
    return new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => { cancelled = true; reject(new Error('aborted')); });
    });
  });
  await expect(loadChapters(paged, book)).rejects.toThrow('page failed');
  expect(cancelled).toBe(true);
  expect(request.mock.calls.some(call => call[0].url.endsWith('/p4'))).toBe(false);
});
