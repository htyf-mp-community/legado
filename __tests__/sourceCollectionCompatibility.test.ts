jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ getString: jest.fn(), set: jest.fn() }),
}));

import { runSourceDebug } from '../src/core/sourceDebug';
import type { BookSource } from '../src/types';

const source: BookSource = {
  bookSourceName: '酷我小说',
  bookSourceUrl: 'http://appi.kuwo.cn',
  bookSourceType: 0,
  customOrder: 4,
  enabled: true,
  enabledExplore: false,
  enabledCookieJar: true,
  searchUrl: '/novels/api/book/search?keyword={{key}}&pi={{page}}&ps=30',
  ruleSearch: {
    bookList: '$.data',
    name: '$.title',
    author: '$.author_name',
    bookUrl: '/novels/api/book/{{$.book_id}}',
  },
  ruleBookInfo: {
    init: '$.data',
    name: '$.title',
    author: '$.author_name',
    tocUrl: '/novels/api/book/{{$.book_id}}/chapters?paging=0',
  },
  ruleToc: {
    chapterList: '$.data',
    chapterName: '$.chapter_title',
    chapterUrl:
      '/novels/api/book/{{$.book_id}}/chapters/{{$.chapter_id}}',
  },
  ruleContent: { content: '$.data.content' },
};

test('runs the declarative source in the reported collection through content', async () => {
  const responses = [
    { data: [{ book_id: '1', title: '三体', author_name: '刘慈欣' }] },
    { data: { book_id: '1', title: '三体', author_name: '刘慈欣' } },
    { data: [{ book_id: '1', chapter_id: '2', chapter_title: '第一章' }] },
    { data: { content: '章节正文' } },
  ];
  globalThis.fetch = jest.fn(async (url: string | URL | Request) => ({
    ok: true,
    status: 200,
    url: String(url),
    headers: { forEach: () => undefined, get: () => null },
    text: async () => JSON.stringify(responses.shift()),
  })) as jest.Mock;

  const result = await runSourceDebug(source, '三体');

  expect(result.books[0].bookUrl).toBe('https://appi.kuwo.cn/novels/api/book/1');
  expect(result.info.tocUrl).toBe(
    'https://appi.kuwo.cn/novels/api/book/1/chapters?paging=0',
  );
  expect(result.chapter.url).toBe(
    'https://appi.kuwo.cn/novels/api/book/1/chapters/2',
  );
  expect(result.content).toBe('章节正文');
});

test('keeps the reported collection source usable with its real headers and response shape', async () => {
  const imported: BookSource = {
    ...source,
    header:
      '{"Accept":"*/*","Connection":"Close","User-Agent":"Dalvik/2.1.0 (Linux; U; Android 8.0.0)"}',
    ruleSearch: {
      ...source.ruleSearch,
      coverUrl: '$.cover_url',
      intro: '$.intro',
      kind:
        '{{$.category_name}},{{$.status}}@js:result.replace(/30/,"连载").replace(/50/,"完结")',
    },
  };
  const responses = [
    {
      code: 200,
      data: [
        {
          book_id: '21041885901615104',
          title: '三体：史上最称职的面壁者',
          author_name: '火炀',
          category_name: '诸天无限',
          status: 50,
        },
      ],
    },
    {
      code: 200,
      data: {
        book_id: '21041885901615104',
        title: '三体：史上最称职的面壁者',
        author_name: '火炀',
      },
    },
    {
      code: 200,
      data: [
        {
          book_id: '21041885901615104',
          chapter_id: '56483893775675668',
          chapter_title: '第一章：欺瞒计划',
        },
      ],
    },
    { code: 200, data: { content: '首章正文' } },
  ];
  globalThis.fetch = jest.fn(async (requestUrl: string | URL | Request) => ({
    ok: true,
    status: 200,
    url: String(requestUrl),
    headers: { forEach: () => undefined, get: () => null },
    text: async () => JSON.stringify(responses.shift()),
  })) as jest.Mock;

  const result = await runSourceDebug(imported, '三体');
  expect(result.books[0]).toMatchObject({
    name: '三体：史上最称职的面壁者',
    author: '火炀',
  });
  expect(result.chapters[0].title).toBe('第一章：欺瞒计划');
  expect(result.content).toBe('首章正文');
});
