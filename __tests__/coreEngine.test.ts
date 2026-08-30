jest.mock('../src/data/storage', () => ({
  appStorage: {
    getString: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
  },
}));

import { jsonPath } from '../src/core/jsonPath';
import {
  buildSourceRequest,
  executeSourceRequest,
  preferredSourceTransportUrl,
} from '../src/core/sourceRequest';
import {
  parseChapters,
  parseExploreBooks,
  parseExploreEntries,
  parseSearchBooks,
  loadChapterContent,
  loadChapterPayload,
  loadChapters,
  loadBookInfo,
  resolveBookInfoTocUrl,
  resolveWebBookUrl,
} from '../src/core/webBook';
import type { BookSource, SearchBook } from '../src/types';
const source: BookSource = {
  bookSourceUrl: 'https://example.com',
  bookSourceName: '测试',
  bookSourceType: 0,
  customOrder: 0,
  enabled: true,
  enabledExplore: true,
  searchUrl:
    'https://example.com/search,{"method":"POST","body":{"q":"searchKey","page":"{{searchPage}}"}}',
  ruleSearch: {
    bookList: '$.data[*]',
    name: '$.title',
    author: '$.author',
    bookUrl: '$.url',
  },
  exploreUrl: '热门::/hot\n完结::/done',
  ruleExplore: {
    bookList: '$.books[*]',
    name: '$.title',
    author: '$.writer',
    bookUrl: '$.url',
  },
  ruleToc: {
    chapterList: '$.chapters[*]',
    chapterName: '$.name',
    chapterUrl: '$.url',
  },
};

test('resolves root-relative web book URLs without relying on the runtime URL implementation', () => {
  expect(
    resolveWebBookUrl(
      '/41/27285_2.html',
      'https://www.sudugu.cc/41/27285.html',
    ),
  ).toBe('https://www.sudugu.cc/41/27285_2.html');
  expect(
    resolveWebBookUrl('//cdn.example.com/a.jpg', 'https://www.sudugu.cc/41/'),
  ).toBe('https://cdn.example.com/a.jpg');
});
describe('core source engine', () => {
  test('builds the bounded conditional search URL used by the imported Fanqie source', () => {
    const fanqie: BookSource = {
      ...source,
      bookSourceUrl: 'https://fqapi.komr.cn',
      searchUrl: `@js:
function getUrl(key) {
  let isNumber = /^\\d+$/.test(key);
  if (isNumber) {
    return \`https://api.example/detail?book_id={{key}}\`;
  } else {
    return \`https://api.example/search?passback={{(page-1)*50}}&query={{key}}\`;
  }
}
getUrl(key)`,
    };
    expect(buildSourceRequest(fanqie, fanqie.searchUrl!, '三体', 3).url).toBe(
      'https://api.example/search?passback=100&query=%E4%B8%89%E4%BD%93',
    );
    expect(buildSourceRequest(fanqie, fanqie.searchUrl!, '123', 1).url).toBe(
      'https://api.example/detail?book_id=123',
    );
  });
  test('reads JSONPath lists and fields', () =>
    expect(jsonPath({ a: { b: [{ x: 1 }, { x: 2 }] } }, '$.a.b[*].x')).toEqual([
      1, 2,
    ]));
  test('builds POST search request', () =>
    expect(
      buildSourceRequest(source, source.searchUrl!, '三体', 2),
    ).toMatchObject({
      url: 'https://example.com/search',
      method: 'POST',
      body: '{"q":"三体","page":"2"}',
    }));
  test('prefers secure transport for legacy HTTP source URLs', () => {
    expect(
      preferredSourceTransportUrl(
        'http://appi.kuwo.cn/novels/api/book/search?keyword=%E4%B8%89%E4%BD%93',
      ),
    ).toBe(
      'https://appi.kuwo.cn/novels/api/book/search?keyword=%E4%B8%89%E4%BD%93',
    );
    expect(preferredSourceTransportUrl('https://example.com/a')).toBe(
      'https://example.com/a',
    );
  });

  test('falls back to the declared HTTP origin when its HTTPS mirror rejects the path', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        url: 'https://legacy.example/search',
        headers: { forEach: () => undefined, get: () => null },
        text: async () => 'not found',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        url: 'http://legacy.example/search',
        headers: { forEach: () => undefined, get: () => null },
        text: async () => '{"data":[]}',
      }) as jest.Mock;

    await expect(
      executeSourceRequest({
        url: 'http://legacy.example/search',
        method: 'GET',
        headers: {},
        sourceId: 'http://legacy.example',
        cookieJar: false,
      }),
    ).resolves.toMatchObject({ data: { data: [] } });
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      'https://legacy.example/search',
      expect.any(Object),
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      'http://legacy.example/search',
      expect.any(Object),
    );
  });
  test('falls back to the declared HTTP URL when HTTPS transport is unavailable', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('TLS unavailable'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        url: 'http://legacy.example/search',
        headers: { forEach: () => undefined, get: () => null },
        text: async () => '{"data":[]}',
      } as unknown as Response);
    await expect(
      executeSourceRequest({
        url: 'http://legacy.example/search',
        method: 'GET',
        headers: {},
        sourceId: 'http://legacy.example',
        cookieJar: false,
      }),
    ).resolves.toMatchObject({ data: { data: [] } });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://legacy.example/search',
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://legacy.example/search',
      expect.any(Object),
    );
    fetchMock.mockRestore();
  });
  test('retries a cached GET 404 once with cache bypass headers', async () => {
    const originalUrl = 'https://www.sudugu.cc/41/27285.html',
      fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async url => {
        const cacheBusted = String(url).includes('_htyf_retry=');
        return {
          ok: cacheBusted,
          status: cacheBusted ? 200 : 404,
          url: String(url),
          headers: { forEach: () => undefined, get: () => null },
          text: async () => cacheBusted ? '<div class="con">正文</div>' : 'cached not found',
        } as unknown as Response;
      });

    await expect(
      executeSourceRequest({
        url: originalUrl,
        method: 'GET',
        headers: {},
        sourceId: 'https://www.sudugu.co',
        cookieJar: false,
      }),
    ).resolves.toMatchObject({ data: '<div class="con">正文</div>' });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/^https:\/\/www\.sudugu\.cc\/41\/27285\.html\?_htyf_retry=\d+$/),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        }),
      }),
    );
    fetchMock.mockRestore();
  });
  test('builds legacy single-quoted form requests used by imported source collections', () =>
    expect(
      buildSourceRequest(
        source,
        "/search/,{'method':'post','body':'keyword={{key}}&page={{page}}','headers':{'Referer':'https://example.com/'}}",
        '三体',
        2,
      ),
    ).toMatchObject({
      url: 'https://example.com/search/',
      method: 'POST',
      body: 'keyword=三体&page=2',
      headers: {
        Referer: 'https://example.com/',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
    }));
  test('accepts legacy single-quoted top-level source headers', () =>
    expect(
      buildSourceRequest(
        {
          ...source,
          header: "{'cookie':'sid=legacy','Referer':'https://example.com/'}",
        },
        '/search',
      ).headers,
    ).toMatchObject({
      cookie: 'sid=legacy',
      Referer: 'https://example.com/',
    }));
  test('unwraps the safe URL-builder script used by Qidian sources', () =>
    expect(
      buildSourceRequest(
        source,
        `@js:url=baseUrl+"/so/{{key}}.html,{'method':'GET','headers':{'Referer':'https://example.com/'}}";java.put('url',url);result=url;`,
        '三体',
      ),
    ).toMatchObject({
      url: 'https://example.com/so/%E4%B8%89%E4%BD%93.html',
      headers: { Referer: 'https://example.com/' },
    }));
  test('unwraps declarative request shells from the supplied source collection', () => {
    expect(
      buildSourceRequest(
        source,
        `<js>/modules/article/search.php,{'charset':'gbk','body':'searchkey={{key}}&searchtype=all','method':'POST'};result='';result;</js>`,
        '三体',
      ),
    ).toMatchObject({
      url: 'https://example.com/modules/article/search.php',
      method: 'POST',
      charset: 'gbk',
      body: 'searchkey=%C8%FD%CC%E5&searchtype=all',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=gbk',
      },
    });
    expect(
      buildSourceRequest(
        source,
        `<js>if(java.ajax(baseUrl)){java.startBrowserAwait(baseUrl);}</js>/search/?keyword={{key}}`,
        '三体',
      ).url,
    ).toBe('https://example.com/search/?keyword=%E4%B8%89%E4%BD%93');
    expect(
      buildSourceRequest(
        source,
        `@js:url="https://example.com/search.php,{'body':'keyword={{key}}','method':'POST'}";if(java.ajax(url)){java.startBrowserAwait(url);};result=url;`,
        '三体',
      ),
    ).toMatchObject({
      url: 'https://example.com/search.php',
      method: 'POST',
      body: 'keyword=三体',
    });
  });
  test('resolves safe baseUrl replacement chains used by 69shuba TOC rules', () => {
    expect(
      resolveBookInfoTocUrl(
        `@js:baseUrl.replace('/txt','').replace('.htm','/')`,
        '',
        'https://69shuba.cx/txt/100.htm',
      ),
    ).toBe('https://69shuba.cx/100/');
    expect(
      resolveBookInfoTocUrl('@js:java.ajax(baseUrl)', '', 'https://x'),
    ).toBe('');
  });
  test('decodes legacy source responses with the declared GBK charset', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      url: 'https://example.com/search',
      headers: { forEach: () => undefined, get: () => null },
      arrayBuffer: async () => new Uint8Array([0xc8, 0xfd, 0xcc, 0xe5]).buffer,
    } as unknown as Response);
    await expect(
      executeSourceRequest(
        buildSourceRequest(source, "/search,{'charset':'gbk'}"),
      ),
    ).resolves.toMatchObject({ data: '三体' });
    fetchMock.mockRestore();
  });
  test('parses and deduplicates search results', () =>
    expect(
      parseSearchBooks(
        source,
        {
          data: [
            { title: 'A', author: 'B', url: '/a' },
            { title: 'A2', url: '/a' },
          ],
        },
        'https://example.com/search',
      ),
    ).toEqual([
      {
        name: 'A',
        author: 'B',
        bookUrl: 'https://example.com/a',
        origin: 'https://example.com',
        originName: '测试',
        sourceType: 0,
        kind: undefined,
        coverUrl: undefined,
        intro: undefined,
        wordCount: undefined,
        latestChapterTitle: undefined,
      },
    ]));
  test('parses real-shaped Kuwo collection results with JSONPath URL templates', () => {
    const kuwo: BookSource = {
      ...source,
      bookSourceUrl: 'http://appi.kuwo.cn',
      ruleSearch: {
        bookList: '$.data',
        name: '$.title',
        author: '$.author_name',
        bookUrl: '/novels/api/book/{{$.book_id}}',
      },
    };
    expect(
      parseSearchBooks(
        kuwo,
        {
          data: [
            { book_id: '101', title: '三体一', author_name: '作者甲' },
            { book_id: '102', title: '三体二', author_name: '作者乙' },
          ],
        },
        'http://appi.kuwo.cn/novels/api/book/search',
      ),
    ).toMatchObject([
      { name: '三体一', bookUrl: 'http://appi.kuwo.cn/novels/api/book/101' },
      { name: '三体二', bookUrl: 'http://appi.kuwo.cn/novels/api/book/102' },
    ]);
  });
  test('follows the supplied Kuwo source from initialized detail through TOC and content', async () => {
    const kuwo: BookSource = {
      ...source,
      bookSourceUrl: 'http://appi.kuwo.cn',
      ruleBookInfo: {
        init: '$.data',
        name: '$.title',
        author: '$.author_name',
        tocUrl: '/novels/api/book/{{$.book_id}}/chapters?paging=0',
      },
      ruleToc: {
        chapterList: '$.data',
        chapterName: '$.chapter_title',
        chapterUrl: '/novels/api/book/{{$.book_id}}/chapters/{{$.chapter_id}}',
      },
      ruleContent: { content: '$.data.content' },
    };
    const responses = [
      {
        data: {
          book_id: '101',
          title: '三体一',
          author_name: '作者甲',
        },
      },
      {
        data: [{ book_id: '101', chapter_id: '8', chapter_title: '第一章' }],
      },
      { data: { content: '公开正文内容' } },
    ];
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(
      async (input: Parameters<typeof fetch>[0]) =>
        ({
          ok: true,
          status: 200,
          headers: { forEach: () => undefined, get: () => null },
          text: async () => JSON.stringify(responses.shift()),
          url: String(input),
        }) as unknown as Response,
    );
    const result = await loadBookInfo(kuwo, {
      bookUrl: 'http://appi.kuwo.cn/novels/api/book/101',
      origin: kuwo.bookSourceUrl,
      originName: kuwo.bookSourceName,
      name: '搜索名',
      author: '',
    });
    expect(result).toMatchObject({
      name: '三体一',
      tocUrl: 'https://appi.kuwo.cn/novels/api/book/101/chapters?paging=0',
    });
    const chapters = await loadChapters(kuwo, result);
    expect(chapters[0]).toMatchObject({
      title: '第一章',
      url: 'https://appi.kuwo.cn/novels/api/book/101/chapters/8',
    });
    await expect(loadChapterContent(kuwo, chapters[0])).resolves.toBe(
      '公开正文内容',
    );
    fetchMock.mockRestore();
  });
  test('follows challenge-wrapped 69shuba rules after Cookie verification', async () => {
    const challenge = `<js>if(result.match(/^<!DOCTYPE html><html lang="en-US"><head><title>Just a moment.../)){java.longToast('verify');result=java.startBrowserAwait(baseUrl,'verify').body();};result;</js>`,
      shuba: BookSource = {
        ...source,
        bookSourceUrl: 'https://www.69shuba.com',
        enabledCookieJar: true,
        ruleBookInfo: {
          init: challenge,
          name: "//meta[@property='og:novel:book_name']/@content",
          author: "//meta[@property='og:novel:author']/@content",
          tocUrl: "@js:baseUrl.replace('.htm','/')",
        },
        ruleToc: {
          chapterList: `${challenge}id.catalog.0@tag.ul.0@tag.a[-1:0]`,
          chapterName: 'text',
          chapterUrl: 'href',
        },
        ruleContent: {
          content: `${challenge}class.txtnav.0@textNodes`,
        },
      };
    const pages = [
      `<meta property="og:novel:book_name" content="测试书"><meta property="og:novel:author" content="作者">`,
      `<div id="catalog"><ul><li><a href="/2.html">第二章</a></li><li><a href="/1.html">第一章</a></li></ul></div>`,
      `<div class="txtnav"><h1>第一章</h1>正文内容</div>`,
    ];
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(
      async (input: Parameters<typeof fetch>[0]) =>
        ({
          ok: true,
          status: 200,
          headers: { forEach: () => undefined, get: () => null },
          text: async () => pages.shift()!,
          url: String(input),
        }) as unknown as Response,
    );
    const info = await loadBookInfo(shuba, {
      bookUrl: 'https://www.69shuba.com/book/8.htm',
      origin: shuba.bookSourceUrl,
      originName: shuba.bookSourceName,
      name: '搜索名',
      author: '',
    });
    expect(info).toMatchObject({
      name: '测试书',
      author: '作者',
      tocUrl: 'https://www.69shuba.com/book/8/',
    });
    const chapters = await loadChapters(shuba, info);
    expect(chapters).toMatchObject([
      { title: '第一章', url: 'https://www.69shuba.com/1.html' },
      { title: '第二章', url: 'https://www.69shuba.com/2.html' },
    ]);
    await expect(loadChapterContent(shuba, chapters[0])).resolves.toBe(
      '正文内容',
    );
    fetchMock.mockRestore();
  });
  test('parses chapter list with absolute URLs', () => {
    const chapterSource: BookSource = {
      ...source,
      ruleToc: {
        ...source.ruleToc,
        updateTime: '$.updated',
        wordCount: '$.words',
      },
    };
    const book = {
      bookUrl: 'https://example.com/b',
      origin: '',
      originName: '',
      name: 'A',
      author: '',
    } as SearchBook;
    expect(
      parseChapters(
        chapterSource,
        book,
        {
          chapters: [{ name: '一', url: '/c1', updated: '今天', words: '1K' }],
        },
        book.bookUrl,
      )[0],
    ).toMatchObject({
      title: '一',
      url: 'https://example.com/c1',
      index: 0,
      tag: '今天',
      wordCount: '1K',
    });
  });
  test('parses legacy HTML chapter nodes with bare text and href extraction', () => {
    const legacySource: BookSource = {
      ...source,
      ruleToc: {
        chapterList: 'id.list.0@tag.a',
        chapterName: 'text',
        chapterUrl: 'href',
      },
    };
    const book = {
      bookUrl: 'https://example.com/book',
      origin: '',
      originName: '',
      name: 'A',
      author: '',
    } as SearchBook;
    expect(
      parseChapters(
        legacySource,
        book,
        '<div id="list"><a href="/1">第一章</a><a href="/2">第二章</a></div>',
        book.bookUrl,
      ),
    ).toMatchObject([
      { title: '第一章', url: 'https://example.com/1' },
      { title: '第二章', url: 'https://example.com/2' },
    ]);
  });
  test('parses HTML/CSS search results and attributes', () => {
    const htmlSource: BookSource = {
      ...source,
      ruleSearch: {
        bookList: 'article.book',
        name: 'a.name@text',
        author: '.author@text',
        bookUrl: 'a.name@href',
        coverUrl: 'img@src',
      },
    };
    expect(
      parseSearchBooks(
        htmlSource,
        '<article class="book"><a class="name" href="/b">书名</a><span class="author">作者</span><img src="/c.jpg"></article>',
        'https://example.com/search',
      )[0],
    ).toMatchObject({
      name: '书名',
      author: '作者',
      bookUrl: 'https://example.com/b',
      coverUrl: 'https://example.com/c.jpg',
    });
  });
  test('supports the safe Qidian element and URL composition rules', () => {
    const qidian = {
      ...source,
      ruleSearch: {
        bookList:
          "<js>path='class.res-book-item';c=java.getElement(path);java.getElement(path);</js>",
        name: 'class.book-info-title.0@tag.a.0@text',
        bookUrl:
          "a[data-bid]@data-bid@js:'https://m.qidian.com/book/'+result+'/'",
      },
    };
    expect(
      parseSearchBooks(
        qidian,
        '<li class="res-book-item"><h2 class="book-info-title"><a data-bid="123">测试书</a></h2></li>',
        'https://www.qidian.com/so/test.html',
      )[0],
    ).toMatchObject({
      name: '测试书',
      bookUrl: 'https://m.qidian.com/book/123/',
    });
  });
  test('keeps regex capture groups for Qidian chapter fields', () => {
    const qidian = {
      ...source,
      ruleToc: {
        chapterList: ':"sS":(\\d),.*?"cN":"(.*?)","id":(\\d+)',
        chapterName: '$2',
        chapterUrl:
          "@js:var bid = baseUrl.match(/\\d+/);'https://vipreader.qidian.com/chapter/'+bid+'/$3/'",
        isVip: "$1@js:result.replace(/1.*/,'false').replace(/0.*/,'true');",
      },
    };
    expect(
      parseChapters(
        qidian,
        { ...({} as SearchBook), bookUrl: 'https://m.qidian.com/book/123/' },
        '"sS":0,"cN":"第一章","id":456',
        'https://m.qidian.com/book/123/',
      )[0],
    ).toMatchObject({
      title: '第一章',
      url: 'https://vipreader.qidian.com/chapter/123/456/',
      isVip: true,
    });
  });
  test('keeps usable legacy search data when an optional cover rule needs JavaScript', () => {
    const legacySource: BookSource = {
      ...source,
      ruleSearch: {
        bookList: 'class.bookbox',
        name: 'tag.a.0@text',
        author: 'class.author.0@text##作者：',
        bookUrl: 'tag.a.0@href',
        coverUrl: 'tag.a.0@href@js:result',
      },
    };
    expect(
      parseSearchBooks(
        legacySource,
        '<div class="bookbox"><a href="/book/1">真实书名</a><span class="author">作者：作者甲</span></div>',
        'https://example.com/search',
      ),
    ).toEqual([
      expect.objectContaining({
        name: '真实书名',
        author: '作者甲',
        bookUrl: 'https://example.com/book/1',
        coverUrl: undefined,
      }),
    ]);
  });
  test('parses explore categories and applies the explore rule', () => {
    expect(parseExploreEntries(source)).toEqual([
      { title: '热门', url: '/hot' },
      { title: '完结', url: '/done' },
    ]);
    expect(
      parseExploreBooks(
        source,
        { books: [{ title: '发现书', writer: '作者', url: '/book' }] },
        'https://example.com/hot',
      )[0],
    ).toMatchObject({
      name: '发现书',
      author: '作者',
      bookUrl: 'https://example.com/book',
    });
  });
  test('supports JSON explore category definitions', () => {
    expect(
      parseExploreEntries({
        ...source,
        exploreUrl: '[{"title":"排行","url":"/rank"}]',
      }),
    ).toEqual([{ title: '排行', url: '/rank' }]);
  });
  test('fails explicitly on JS rules', () =>
    expect(() => jsonPath({}, '$.a@js:result')).toThrow('JavaScript'));
  test('loads paginated chapter lists and reindexes deduplicated chapters', async () => {
    const pagedSource: BookSource = {
      ...source,
      ruleToc: {
        ...source.ruleToc,
        nextTocUrl: '$.next',
      },
    };
    const responses = [
      { chapters: [{ name: '一', url: '/1' }], next: '/toc/2' },
      {
        chapters: [
          { name: '一重复', url: '/1' },
          { name: '二', url: '/2' },
        ],
      },
    ];
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input: Parameters<typeof fetch>[0]) => {
        const data = responses.shift();
        return {
          ok: true,
          text: async () => JSON.stringify(data),
          url: String(input),
        } as Response;
      });
    const book = {
      bookUrl: 'https://example.com/book',
      tocUrl: 'https://example.com/toc/1',
      origin: source.bookSourceUrl,
      originName: source.bookSourceName,
      name: '书',
      author: '',
    } as SearchBook;
    await expect(loadChapters(pagedSource, book)).resolves.toMatchObject([
      { title: '一', index: 0 },
      { title: '二', index: 1 },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockRestore();
  });
  test('keeps paginated main/sub content separate and applies cleanup', async () => {
    const contentSource: BookSource = {
      ...source,
      ruleContent: {
        content: '$.content',
        subContent: '$.note',
        nextContentUrl: '$.next',
        replaceRegex: '广告##',
      },
    };
    const responses = [
      { content: '<p>正文一</p>广告', note: '副文', next: '/content/2' },
      { content: '<p>正文二</p>' },
    ];
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(
      async (input: Parameters<typeof fetch>[0]) =>
        ({
          ok: true,
          text: async () => JSON.stringify(responses.shift()),
          url: String(input),
        }) as Response,
    );
    await expect(
      loadChapterPayload(contentSource, {
        url: 'https://example.com/content/1',
        title: '第一章',
        index: 0,
        bookUrl: 'https://example.com/book',
        baseUrl: 'https://example.com/book',
        isVolume: false,
        isVip: false,
        isPay: false,
      }),
    ).resolves.toEqual({ content: '正文一\n\n正文二', subContent: '副文' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockRestore();
  });
  test('follows a Sudugu root-relative XPath next-page link', async () => {
    const suduguSource: BookSource = {
      ...source,
      bookSourceUrl: 'https://www.sudugu.co',
      ruleContent: {
        content: 'class.con.0@html',
        nextContentUrl:
          "//div[@class='prenext']/span/a[text()='下一页']/@href",
      },
    };
    const firstUrl = 'https://www.sudugu.cc/41/27285.html',
      secondUrl = 'https://www.sudugu.cc/41/27285_2.html',
      fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(
        async input => ({
          ok: true,
          status: 200,
          headers: { forEach: () => undefined, get: () => null },
          text: async () =>
            String(input) === firstUrl
              ? '<div class="con">第一页</div><div class="prenext"><span><a href="/41/27285_2.html">下一页</a></span></div>'
              : '<div class="con">第二页</div>',
          url: String(input),
        }) as unknown as Response,
      );

    await expect(
      loadChapterContent(suduguSource, {
        url: firstUrl,
        title: '第1章 初入',
        index: 0,
        bookUrl: 'https://www.sudugu.cc/41/',
        baseUrl: 'https://www.sudugu.cc/41/',
        isVolume: false,
        isVip: false,
        isPay: false,
      }),
    ).resolves.toBe('第一页\n第二页');
    expect(fetchMock).toHaveBeenCalledWith(secondUrl, expect.any(Object));
    fetchMock.mockRestore();
  });
  test('keeps every node selected by a chapter content rule', async () => {
    const multiParagraphSource: BookSource = {
      ...source,
      ruleContent: { content: 'id.booktxt.0@tag.p@text' },
    };
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: { forEach: () => undefined, get: () => null },
      text: async () =>
        '<div id="booktxt"><p>第一段</p><p>第二段</p><p>第三段</p></div>',
      url: 'https://example.com/chapter/1',
    } as unknown as Response);
    await expect(
      loadChapterContent(multiParagraphSource, {
        url: 'https://example.com/chapter/1',
        title: '第一章',
        index: 0,
        bookUrl: 'https://example.com/book',
        baseUrl: 'https://example.com/book',
        isVolume: false,
        isVip: false,
        isPay: false,
      }),
    ).resolves.toBe('第一段\n第二段\n第三段');
    fetchMock.mockRestore();
  });
  test('normalizes double-encoded HTML book introductions', async () => {
    const introSource: BookSource = {
      ...source,
      ruleBookInfo: {
        name: 'class.title.0@text',
        intro: 'class.des.0@html',
      },
    };
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: { forEach: () => undefined, get: () => null },
      text: async () =>
        '<h1 class="title">测试书</h1><div class="des">&amp;#x8bb8;&amp;#x4e45;&lt;p class=&quot;detail-btn&quot;&gt;&lt;span&gt;&lt;/span&gt;&lt;/p&gt;</div>',
      url: 'https://example.com/book/1',
    } as unknown as Response);

    await expect(
      loadBookInfo(introSource, {
        name: '测试书',
        author: '',
        bookUrl: 'https://example.com/book/1',
        origin: introSource.bookSourceUrl,
        originName: introSource.bookSourceName,
      }),
    ).resolves.toMatchObject({ intro: '许久' });
    fetchMock.mockRestore();
  });
  test('applies leading-separator Legado content cleanup rules', async () => {
    const suduguSource: BookSource = {
      ...source,
      ruleContent: {
        content: 'class.con.0@html',
        replaceRegex: '##[\\(（]本章完[\\)）]$',
      },
    };
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: { forEach: () => undefined, get: () => null },
      text: async () =>
        '<div class="con">&#x7b2c;&#x4e00;&#x6bb5;<br>&#31532;&#20108;&#27573;（本章完）</div>',
      url: 'https://www.sudugu.cc/41/27285.html',
    } as unknown as Response);
    await expect(
      loadChapterContent(suduguSource, {
        url: 'https://www.sudugu.cc/41/27285.html',
        title: '第1章 初入',
        index: 0,
        bookUrl: 'https://www.sudugu.cc/41/',
        baseUrl: 'https://www.sudugu.cc/41/',
        isVolume: false,
        isVip: false,
        isPay: false,
      }),
    ).resolves.toBe('第一段\n第二段');
    fetchMock.mockRestore();
  });
  test('preserves video HTML and inline DASH manifests', async () => {
    const videoSource: BookSource = {
      ...source,
      bookSourceType: 4,
      ruleContent: { content: '$.content' },
    };
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          content: '<video src="https://cdn.test/a.m3u8"></video>',
        }),
      url: 'https://example.com/video',
    } as Response);
    await expect(
      loadChapterContent(videoSource, {
        url: 'https://example.com/video',
        title: '视频',
        index: 0,
        bookUrl: 'b',
        baseUrl: 'https://example.com/',
        isVolume: false,
        isVip: false,
        isPay: false,
      }),
    ).resolves.toBe('<video src="https://cdn.test/a.m3u8"></video>');
    fetchMock.mockRestore();
  });
});
