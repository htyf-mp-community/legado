jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ getString: jest.fn(), set: jest.fn() }),
}));

import {
  fetchRssArticleContent,
  fetchRssFeedPage,
  parseRssContentPage,
  parseRssFeed,
  parseRssByRules,
  parseRssSortEntries,
} from '../src/core/rss';
import {
  clearRssFavorites,
  deleteRssFavoriteGroup,
  mergeRssArticles,
  filterRssArticles,
  mergeRssSources,
  parseRssSources,
  rssFavoriteGroups,
  setRssFavorite,
  updateRssArticle,
} from '../src/data/rss';
import type { RssSource } from '../src/types';

const source: RssSource = {
  sourceUrl: 'https://example.com/feed.xml',
  sourceName: '示例',
  enabled: true,
  customOrder: 0,
};

test('parses RSS items, CDATA, image and relative links', () => {
  const articles = parseRssFeed(
    `<rss><channel><item><title><![CDATA[标题]]></title><link>/one</link><pubDate>2026-01-01</pubDate><description><![CDATA[<p>摘要</p><img src="/cover.jpg">]]></description></item></channel></rss>`,
    source,
  );
  expect(articles[0]).toMatchObject({
    title: '标题',
    link: 'https://example.com/one',
    image: 'https://example.com/cover.jpg',
    read: false,
    starred: false,
  });
});

it('parses custom RSS HTML rules and resolves relative links', () => {
  const source = {
    sourceUrl: 'https://example.com/feed',
    sourceName: 'Custom',
    enabled: true,
    customOrder: 0,
    ruleArticles: '.post',
    ruleTitle: '.title@text',
    ruleLink: 'a@href',
    ruleDescription: '.desc@text',
    ruleImage: 'img@src',
  };
  const result = parseRssByRules(
    '<div class="post"><a href="/a"><b class="title">A</b></a><p class="desc">D</p><img src="/a.jpg"></div>',
    source,
  );
  expect(result[0]).toMatchObject({
    title: 'A',
    link: 'https://example.com/a',
    description: 'D',
    image: 'https://example.com/a.jpg',
  });
});

test('parses Atom entries and href links', () => {
  expect(
    parseRssFeed(
      '<feed><entry><title>Atom</title><link href="/atom"/><updated>2026</updated><content>正文</content></entry></feed>',
      source,
    )[0],
  ).toMatchObject({ title: 'Atom', link: 'https://example.com/atom' });
});

test('imports and overwrites RSS sources by URL', () => {
  const old = parseRssSources(
    '{"sourceUrl":"https://a","sourceName":"旧","enabled":false}',
  );
  const incoming = parseRssSources(
    '[{"sourceUrl":"https://a","sourceName":"新"},{"sourceUrl":"https://b","sourceName":"B"}]',
  );
  expect(mergeRssSources(old, incoming).map(item => item.sourceName)).toEqual([
    'B',
    '新',
  ]);
});

test('preserves read and favorite state while refreshing articles', () => {
  const fresh = parseRssFeed(
    '<rss><item><title>A</title><link>/a</link></item></rss>',
    source,
  );
  const saved = updateRssArticle(fresh, fresh[0].id, {
    read: true,
    starred: true,
    title: '旧标题',
  });
  expect(
    mergeRssArticles(saved, [{ ...fresh[0], title: '新标题' }])[0],
  ).toMatchObject({
    title: '新标题',
    read: true,
    starred: true,
  });
});

test('filters global RSS history and favorites while keeping the live feed scoped', () => {
  const articles = [
    {
      id: 'a',
      origin: 'one',
      sort: 'news',
      title: 'A',
      link: 'a',
      read: true,
      starred: false,
      readTime: 10,
    },
    {
      id: 'b',
      origin: 'two',
      sort: 'other',
      title: 'B',
      link: 'b',
      read: true,
      starred: true,
      readTime: 20,
    },
    {
      id: 'c',
      origin: 'one',
      sort: 'news',
      title: 'C',
      link: 'c',
      read: false,
      starred: true,
    },
  ];
  expect(
    filterRssArticles(articles, 'all', 'one', 'news').map(x => x.id),
  ).toEqual(['a', 'c']);
  expect(filterRssArticles(articles, 'history').map(x => x.id)).toEqual([
    'b',
    'a',
  ]);
  expect(filterRssArticles(articles, 'favorites').map(x => x.id)).toEqual([
    'b',
    'c',
  ]);
});

test('parses RSS content and resolves next-page URLs', () => {
  const custom = {
    ...source,
    ruleContent: '.body@text',
    nextContentUrl: '.next@href',
  };
  expect(
    parseRssContentPage(
      '<main><p class="body">正文</p><a class="next" href="/p2">下页</a></main>',
      'https://example.com/p1',
      custom,
    ),
  ).toEqual({ content: '正文', next: ['https://example.com/p2'] });
});

test('follows a single RSS next-page chain without loops', async () => {
  const custom = {
      ...source,
      ruleContent: '$.content',
      nextContentUrl: '$.next',
    },
    article = {
      id: 'a',
      origin: source.sourceUrl,
      sort: '示例',
      title: 'A',
      link: 'https://example.com/p1',
      read: false,
      starred: false,
    };
  const pages: Record<string, string> = {
    'https://example.com/p1': '{"content":"一","next":"/p2"}',
    'https://example.com/p2': '{"content":"二","next":"/p1"}',
  };
  const fetcher = jest.fn(async (url: string) => ({
    ok: true,
    status: 200,
    url,
    text: async () => pages[url],
  })) as unknown as typeof fetch;
  await expect(fetchRssArticleContent(article, custom, fetcher)).resolves.toBe(
    '一\n二',
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test('fetches multiple declared RSS pages in source order', async () => {
  const custom = {
      ...source,
      ruleContent: '$.content',
      nextContentUrl: '$.next',
    },
    article = {
      id: 'a',
      origin: source.sourceUrl,
      sort: '示例',
      title: 'A',
      link: 'https://example.com/p1',
      read: false,
      starred: false,
    };
  const pages: Record<string, string> = {
    'https://example.com/p1': '{"content":"一","next":["/p2","/p3"]}',
    'https://example.com/p2': '{"content":"二"}',
    'https://example.com/p3': '{"content":"三"}',
  };
  const fetcher = jest.fn(async (url: string) => ({
    ok: true,
    status: 200,
    url,
    text: async () => pages[url],
  })) as unknown as typeof fetch;
  await expect(
    fetchRssArticleContent(article, custom, fetcher, 2),
  ).resolves.toBe('一\n二\n三');
});

test('parses line, object and array RSS sort definitions', () => {
  expect(
    parseRssSortEntries({ ...source, sortUrl: '热门::/hot\n完结::/done' }),
  ).toEqual([
    { title: '热门', url: '/hot' },
    { title: '完结', url: '/done' },
  ]);
  expect(
    parseRssSortEntries({ ...source, sortUrl: '{"排行":"/rank"}' }),
  ).toEqual([{ title: '排行', url: '/rank' }]);
  expect(
    parseRssSortEntries({
      ...source,
      sortUrl: '[{"title":"分类","url":"/category"}]',
    }),
  ).toEqual([{ title: '分类', url: '/category' }]);
});

test('loads custom RSS pages with keyword/page variables and resolves the next URL', async () => {
  const custom = {
      ...source,
      sourceUrl: 'https://example.com',
      ruleArticles: '$.items[*]',
      ruleTitle: '$.title',
      ruleLink: '$.url',
      ruleNextPage: '$.next',
    },
    fetcher = jest.fn(async (url: string) => ({
      ok: true,
      status: 200,
      url: 'https://example.com/list/2',
      text: async () => '{"items":[{"title":"A","url":"/a"}],"next":"/list/3"}',
    })) as unknown as typeof fetch;
  await expect(
    fetchRssFeedPage(
      custom,
      {
        sortName: 'Search',
        url: '/search?key={{key}}&page={{page}}',
        page: 2,
        key: 'demo',
      },
      fetcher,
    ),
  ).resolves.toMatchObject({
    articles: [{ title: 'A', sort: 'Search', link: 'https://example.com/a' }],
    nextUrl: 'https://example.com/list/3',
  });
  expect(fetcher).toHaveBeenCalledWith(
    'https://example.com/search?key=demo&page=2',
    expect.any(Object),
  );
});

test('keeps PAGE pagination on the template URL for the next page number', async () => {
  const custom = {
      ...source,
      ruleArticles: '$.items[*]',
      ruleTitle: '$.title',
      ruleLink: '$.url',
      ruleNextPage: 'PAGE',
    },
    fetcher = jest.fn(async () => ({
      ok: true,
      status: 200,
      url: 'https://example.com/list?page=1',
      text: async () => '{"items":[]}',
    })) as unknown as typeof fetch;
  await expect(
    fetchRssFeedPage(custom, { url: '/list?page={{page}}' }, fetcher),
  ).resolves.toMatchObject({ articles: [], nextUrl: '/list?page={{page}}' });
});

test('assigns, filters and removes RSS favorite groups without deleting articles', () => {
  const articles = [
      {
        id: 'a',
        origin: 'one',
        sort: 'news',
        title: 'A',
        link: 'a',
        read: true,
        starred: false,
      },
      {
        id: 'b',
        origin: 'two',
        sort: 'news',
        title: 'B',
        link: 'b',
        read: false,
        starred: false,
      },
    ],
    grouped = setRssFavorite(
      setRssFavorite(articles, 'a', true, 'Tech'),
      'b',
      true,
      'Life',
    );
  expect(rssFavoriteGroups(grouped)).toEqual(['Life', 'Tech']);
  expect(
    filterRssArticles(grouped, 'favorites', '', '', 'Tech').map(
      item => item.id,
    ),
  ).toEqual(['a']);
  const withoutTech = deleteRssFavoriteGroup(grouped, 'Tech');
  expect(withoutTech.find(item => item.id === 'a')).toMatchObject({
    starred: false,
  });
  expect(clearRssFavorites(withoutTech)).toHaveLength(2);
  expect(clearRssFavorites(withoutTech).every(item => !item.starred)).toBe(
    true,
  );
});
