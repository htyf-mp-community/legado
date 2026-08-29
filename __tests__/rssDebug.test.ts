jest.mock('../src/data/storage', () => ({
  appStorage: { getString: jest.fn(), set: jest.fn(), remove: jest.fn() },
}));

import { resolveRssDebugInput, runRssSourceDebug } from '../src/core/rssDebug';
import type { RssSource } from '../src/types';

const source: RssSource = {
  sourceUrl: 'https://rss.test/feed',
  sourceName: '测试 RSS',
  enabled: true,
  customOrder: 0,
  searchUrl: '/search?q={{key}}',
  ruleArticles: '$.items[*]',
  ruleTitle: '$.title',
  ruleLink: '$.url',
  ruleContent: 'article@text',
};

test('resolves keyword, category and direct URL debug inputs', () => {
  expect(resolveRssDebugInput(source, '关键字')).toEqual({
    sortName: '关键字',
    url: '/search?q={{key}}',
    key: '关键字',
  });
  expect(resolveRssDebugInput(source, '分类::/category')).toEqual({
    sortName: '分类',
    url: '/category',
    key: '',
  });
  expect(resolveRssDebugInput(source, 'https://other.test/list')).toEqual({
    sortName: '测试 RSS',
    url: 'https://other.test/list',
    key: '',
  });
});

test('debugs list and first article content while retaining raw responses', async () => {
  const responses = [
      {
        url: 'https://rss.test/search?q=关键字',
        body: '{"items":[{"title":"文章","url":"/article"}]}',
      },
      {
        url: 'https://rss.test/article',
        body: '<article>正文内容</article>',
      },
    ],
    fetcher = jest.fn(async () => {
      const next = responses.shift()!;
      return {
        ok: true,
        status: 200,
        url: next.url,
        text: async () => next.body,
      } as Response;
    }) as unknown as typeof fetch,
    events: string[] = [];
  const result = await runRssSourceDebug(
    source,
    '关键字',
    event => events.push(`${event.stage}:${event.status}`),
    fetcher,
  );
  expect(result.articles[0]).toMatchObject({
    title: '文章',
    link: 'https://rss.test/article',
  });
  expect(result.content).toBe('正文内容');
  expect(result.listSource).toContain('items');
  expect(result.contentSource).toContain('正文内容');
  expect(events).toEqual(
    expect.arrayContaining([
      'list-parse:success',
      'content-parse:success',
      'complete:success',
    ]),
  );
});
