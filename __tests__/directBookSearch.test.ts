jest.mock('../src/data/storage', () => ({
  appStorage: { getString: jest.fn(), set: jest.fn(), remove: jest.fn() },
}));
jest.mock('../src/core/sourceRequest', () => ({
  buildSourceSearchRequest: jest.fn(async (_source, rule) => ({ url: `https://example.com${rule}` })),
  buildSourcePageRequest: jest.fn((_source, url) => ({ url })),
  executeSourceRequest: jest.fn(),
}));

import { executeSourceRequest } from '../src/core/sourceRequest';
import { exploreSource, loadBookInfo, loadChapters, searchSource } from '../src/core/webBook';
import type { BookSource } from '../src/types';

const request = executeSourceRequest as jest.MockedFunction<typeof executeSourceRequest>;
const source: BookSource = {
  bookSourceUrl: 'https://example.com', bookSourceName: '直达详情', bookSourceType: 0,
  customOrder: 0, enabled: true, enabledExplore: true, searchUrl: '/search',
  bookUrlPattern: 'https://example\\.com/book/\\d+',
  ruleSearch: { bookList: '.search-item', name: 'a@text', bookUrl: 'a@href' },
  ruleBookInfo: { name: 'h1@text', author: '.author@text', tocUrl: '' },
  ruleToc: { chapterList: 'class.chapters@tag.li', chapterName: 'tag.a@text', chapterUrl: 'tag.a@href' },
};
const html = '<h1>直达书</h1><p class="author">作者甲</p><ul class="chapters"><li><a href="/chapter/1">第一章</a></li></ul>';

beforeEach(() => request.mockReset());

test('a redirect to a matching detail URL yields a book and reuses its response for detail and contents', async () => {
  request.mockResolvedValueOnce({ url: 'https://example.com/book/1', data: html });
  const [book] = await searchSource(source, '直达书');
  expect(book).toMatchObject({ name: '直达书', author: '作者甲', bookUrl: 'https://example.com/book/1' });
  const info = await loadBookInfo(source, book);
  const chapters = await loadChapters(source, info);
  expect(chapters).toEqual([expect.objectContaining({ title: '第一章', url: 'https://example.com/chapter/1' })]);
  expect(request).toHaveBeenCalledTimes(1);
});

test('empty list falls back to detail rules only when bookUrlPattern is absent', async () => {
  const withoutPattern = { ...source, bookUrlPattern: undefined };
  request.mockResolvedValue({ url: 'https://example.com/search', data: html });
  expect((await searchSource(withoutPattern, '直达书'))[0]).toMatchObject({ name: '直达书' });
  expect(await searchSource(source, '直达书')).toEqual([]);
  expect((await exploreSource(withoutPattern, { title: '发现', url: '/explore' }))[0]).toMatchObject({ name: '直达书' });
  expect(await exploreSource(source, { title: '发现', url: '/explore' })).toEqual([]);
});

test('a URL pattern matches the complete redirect URL, not a substring', async () => {
  request.mockResolvedValue({ url: 'https://example.com/book/1/extra', data: html });
  expect(await searchSource(source, '直达书')).toEqual([]);
});

test('a matched list does not fall back when its entries have no name', async () => {
  request.mockResolvedValue({ url: 'https://example.com/search', data: `${html}<div class="search-item"><a href="/x"></a></div>` });
  expect(await searchSource({ ...source, bookUrlPattern: undefined }, '直达书')).toEqual([]);
});

test('cached first-page contents still request and append a distinct next page', async () => {
  const paged = { ...source, ruleToc: { ...source.ruleToc, nextTocUrl: '.next@href' } };
  request.mockResolvedValueOnce({ url: 'https://example.com/book/1', data: `${html}<a class="next" href="/page/2">下一页</a>` });
  request.mockResolvedValueOnce({ url: 'https://example.com/page/2', data: '<ul class="chapters"><li><a href="/chapter/2">第二章</a></li></ul>' });
  const [book] = await searchSource(paged, '直达书');
  const chapters = await loadChapters(paged, await loadBookInfo(paged, book));
  expect(chapters.map(chapter => chapter.title)).toEqual(['第一章', '第二章']);
  expect(request).toHaveBeenCalledTimes(2);
});

test('a distinct contents URL is fetched instead of reusing detail HTML', async () => {
  const separate = { ...source, ruleBookInfo: { ...source.ruleBookInfo, tocUrl: '.toc@href' } };
  request.mockResolvedValueOnce({ url: 'https://example.com/book/1', data: `${html}<a class="toc" href="/contents">目录</a>` });
  request.mockResolvedValueOnce({ url: 'https://example.com/contents', data: '<ul class="chapters"><li><a href="/chapter/2">第二章</a></li></ul>' });
  const [book] = await searchSource(separate, '直达书');
  const chapters = await loadChapters(separate, await loadBookInfo(separate, book));
  expect(chapters.map(chapter => chapter.title)).toEqual(['第二章']);
  expect(request).toHaveBeenCalledTimes(2);
});

test('a list item whose URL is the response URL reuses the same response for details', async () => {
  const list = '<h1>详情名</h1><p class="author">作者乙</p><div class="search-item"><a href="/search">列表名</a></div>';
  request.mockResolvedValueOnce({ url: 'https://example.com/search', data: list });
  const [book] = await searchSource({ ...source, bookUrlPattern: undefined }, '列表名');
  expect(book.name).toBe('列表名');
  expect(await loadBookInfo(source, book)).toMatchObject({ name: '列表名', author: '作者乙' });
  expect(request).toHaveBeenCalledTimes(1);
});

test('detail redirects also retain parsed JSON responses', async () => {
  const jsonSource = { ...source, ruleBookInfo: { name: '$.book.name', author: '$.book.author' } };
  request.mockResolvedValueOnce({ url: 'https://example.com/book/1', data: { book: { name: 'JSON 书', author: '作者丙' } } });
  const [book] = await searchSource(jsonSource, 'JSON 书');
  expect(await loadBookInfo(jsonSource, book)).toMatchObject({ name: 'JSON 书', author: '作者丙' });
  expect(request).toHaveBeenCalledTimes(1);
});
