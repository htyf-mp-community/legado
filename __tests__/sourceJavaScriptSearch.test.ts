jest.mock('../src/data/storage', () => ({
  appStorage: { getString: jest.fn(), set: jest.fn(), remove: jest.fn() },
}));
import sourceData from './fixtures/source-8043.json';
import { parseBookSources } from '../src/data/sources';
import { searchSource, parseChapters } from '../src/core/webBook';

const source = { ...parseBookSources(JSON.stringify(sourceData))[0], concurrentRate: '0' };
const response = (body: string, url: string) => ({
  ok: true, status: 200, url,
  headers: { get: () => null, forEach: () => {} },
  text: async () => body,
});

test('the default source runs its real search script and parses a book', async () => {
  globalThis.fetch = jest.fn()
    .mockResolvedValueOnce(response('<form action="/search01.html">', 'https://www.xsbook.org/'))
    .mockResolvedValueOnce(response('<div class="item"><a href="/book/1/"></a><dl><dt><a>西游记</a></dt></dl><div class="btm"><a>吴承恩</a></div></div>', 'https://www.xsbook.org/search01.html')) as jest.Mock;
  const books = await searchSource(source, '西游记');
  expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  expect(books).toHaveLength(1);
  expect(books[0]).toMatchObject({ name: '西游记', author: '吴承恩' });
  expect(books[0].bookUrl).toContain('/book/1/');
});

test('the default source filters duplicate chapters and applies URL scripts', () => {
  const book = { bookUrl: 'http://www.xsbook.org/book/1/', origin: source.bookSourceUrl, originName: source.bookSourceName, name: '西游记', author: '吴承恩' };
  const html = '<div id="list"><dl><a href="/1.html">第一章</a><a href="/2.html">第二章</a><a href="/1.html">重复</a></dl></div>';
  const chapters = parseChapters(source, book, html, book.bookUrl);
  expect(chapters.map(chapter => chapter.title)).toEqual(['第二章', '重复']);
  expect(chapters[0].url).toContain('/2.html');
  expect(chapters[0].url).toContain('retry');
});

test('chapter pagination stops before the next chapter', async () => {
  const { loadChapterPayload } = require('../src/core/webBook');
  globalThis.fetch = jest.fn()
    .mockResolvedValueOnce(response('<div id="booktxt">第一页正文</div><a id="next_url" href="/1_2.html">下一页</a>', 'https://www.xsbook.org/1.html'))
    .mockResolvedValueOnce(response('<div id="booktxt">第二页正文</div><a id="next_url" href="/2.html">下一章</a>', 'https://www.xsbook.org/1_2.html')) as jest.Mock;
  const chapter = {url:'https://www.xsbook.org/1.html,{"retry":2}', nextChapterUrl:'https://www.xsbook.org/2.html,{"retry":2}',title:'第一章',index:0,bookUrl:'https://www.xsbook.org/book/',baseUrl:'https://www.xsbook.org/book/'};
  const result = await loadChapterPayload(source, chapter);
  expect(result.content).toContain('第一页正文');
  expect(result.content).toContain('第二页正文');
  expect(globalThis.fetch).toHaveBeenCalledTimes(2);
});

test('chapter scripts receive each requested page as baseUrl even after redirects', async () => {
  const { loadChapterPayload } = require('../src/core/webBook');
  const scripted = {...source, ruleContent:{
    content:'@js:baseUrl + " | " + java.getString("#booktxt@text")',
    nextContentUrl:'@js:baseUrl.indexOf("/chapter/one") >= 0 ? "/chapter/two" : ""',
  }};
  globalThis.fetch = jest.fn()
    .mockResolvedValueOnce(response('<div id="booktxt">第一页</div>', 'https://www.xsbook.org/redirected'))
    .mockResolvedValueOnce(response('<div id="booktxt">第二页</div>', 'https://www.xsbook.org/other')) as jest.Mock;
  const chapter = {url:'https://www.xsbook.org/chapter/one',title:'第一章',index:0,bookUrl:'https://www.xsbook.org/book/',baseUrl:'https://www.xsbook.org/book/'};
  const result = await loadChapterPayload(scripted, chapter);
  expect(result.content).toContain('https://www.xsbook.org/chapter/one | 第一页');
  expect(result.content).toContain('https://www.xsbook.org/chapter/two | 第二页');
  expect(globalThis.fetch).toHaveBeenCalledTimes(2);
});

test('whole chapter replacement scripts keep the initial chapter URL', async () => {
  const { loadChapterPayload } = require('../src/core/webBook');
  const scripted = {...source, ruleContent:{content:'#booktxt@text', replaceRegex:'@js:result + " " + baseUrl'}};
  const chapter = {url:'https://www.xsbook.org/chapter/one',title:'第一章',index:0,bookUrl:'https://www.xsbook.org/book/',baseUrl:'https://www.xsbook.org/book/'};
  globalThis.fetch = jest.fn().mockResolvedValue(response('<div id="booktxt">正文</div>', 'https://www.xsbook.org/redirected')) as jest.Mock;
  const result = await loadChapterPayload(scripted, chapter);
  expect(result.content).toContain('正文 https://www.xsbook.org/chapter/one');
});

test('chapter rules receive original page, chapter metadata and the next chapter boundary', async () => {
  const { loadChapterPayload } = require('../src/core/webBook');
  const scripted = {...source, ruleContent:{
    content:'tag.p@text\n@js:result+":"+title+":"+chapter.index+":"+(src.indexOf("原始页面")>=0)+":"+(nextChapterUrl===chapter.nextChapterUrl)',
    replaceRegex:'@js:result+":"+(src.indexOf("原始页面")>=0)',
  }};
  const chapter = {url:'https://www.xsbook.org/1',nextChapterUrl:'https://www.xsbook.org/2',title:'第一章',index:4,bookUrl:'https://www.xsbook.org/book/',baseUrl:'https://www.xsbook.org/book/'};
  globalThis.fetch = jest.fn().mockResolvedValue(response('<p>正文</p><i>原始页面</i>', chapter.url)) as jest.Mock;
  const result = await loadChapterPayload(scripted, chapter);
  expect(result.content).toContain('正文:第一章:4:true:true:true');
});

test('search rule scripts receive the final search response URL', async () => {
  const scripted = {...source, searchUrl:'/search', bookUrlPattern: undefined, ruleSearch:{
    bookList:'<js>if(baseUrl !== "https://www.xsbook.org/results") throw "wrong baseUrl"; result;</js>class.item',
    name:'@js:baseUrl.indexOf("/results") >= 0 ? result.text() : "错误"',
    bookUrl:'@js:baseUrl + "/book"',
    author:'@js:baseUrl.indexOf("/results") >= 0 ? "作者" : "错误"',
  }};
  globalThis.fetch = jest.fn().mockResolvedValue(response('<div class="item">西游记</div>', 'https://www.xsbook.org/results')) as jest.Mock;
  const books = await searchSource(scripted, '西游记');
  expect(books).toHaveLength(1);
  expect(books[0]).toMatchObject({name:'西游记', author:'作者', bookUrl:'https://www.xsbook.org/results/book'});
});

test('detail scripts resolve URL lookups against the final response URL', async () => {
  const { loadBookInfo } = require('../src/core/webBook');
  const scripted = {...source, ruleBookInfo:{
    intro:'@js:java.getString("tag.a@href",null,true)',
  }};
  const book = {bookUrl:'https://www.xsbook.org/book/1',origin:source.bookSourceUrl,originName:source.bookSourceName,name:'西游记',author:''};
  globalThis.fetch = jest.fn().mockResolvedValue(response('<a href="next.html">链接</a>', 'https://www.xsbook.org/redirect/entry.html')) as jest.Mock;
  const info = await loadBookInfo(scripted, book);
  expect(info.intro).toBe('https://www.xsbook.org/redirect/next.html');
});

test('detail scripts retain the requested book URL after redirect', async () => {
  const { loadBookInfo } = require('../src/core/webBook');
  const scripted = {...source, ruleBookInfo:{
    init:'<js>if(baseUrl !== "https://www.xsbook.org/book/1") throw "wrong baseUrl"; result;</js>class.detail',
    name:'@js:baseUrl + " " + result.text()',
    tocUrl:'@js:baseUrl + "/toc"',
  }};
  const book = {bookUrl:'https://www.xsbook.org/book/1',origin:source.bookSourceUrl,originName:source.bookSourceName,name:'',author:''};
  globalThis.fetch = jest.fn().mockResolvedValue(response('<div class="detail">书名</div>', 'https://www.xsbook.org/redirected')) as jest.Mock;
  const info = await loadBookInfo(scripted, book);
  expect(info.name).toBe('https://www.xsbook.org/book/1 书名');
  expect(info.tocUrl).toBe('https://www.xsbook.org/book/1/toc');
});

test('directory scripts receive each requested page URL after redirects', async () => {
  const { loadChapters } = require('../src/core/webBook');
  const scripted = {...source, ruleToc:{
    chapterList:'<js>if(baseUrl.indexOf("/toc/") < 0) throw "wrong baseUrl"; result;</js>tag.a',
    chapterName:'@js:baseUrl + " " + result.text()',
    chapterUrl:'@js:result.attr("href")',
    nextTocUrl:'@js:baseUrl.indexOf("/toc/one") >= 0 ? "/toc/two" : ""',
  }};
  const book = {bookUrl:'https://www.xsbook.org/book',tocUrl:'https://www.xsbook.org/toc/one',origin:source.bookSourceUrl,originName:source.bookSourceName,name:'书',author:''};
  globalThis.fetch = jest.fn()
    .mockResolvedValueOnce(response('<a href="/1">第一章</a>', 'https://www.xsbook.org/redirect-one'))
    .mockResolvedValueOnce(response('<a href="/2">第二章</a>', 'https://www.xsbook.org/redirect-two')) as jest.Mock;
  const chapters = await loadChapters(scripted, book);
  expect(chapters.map((chapter: {title:string}) => chapter.title)).toEqual([
    'https://www.xsbook.org/toc/one 第一章',
    'https://www.xsbook.org/toc/two 第二章',
  ]);
  expect(globalThis.fetch).toHaveBeenCalledTimes(2);
});

test('rebuilding a chapter list refreshes its next-chapter boundaries', () => {
  const { finalizeChapterOrder } = require('../src/core/webBook');
  const base = {title:'章节',bookUrl:'https://example.org/',baseUrl:'https://example.org/',index:0,isVolume:false,isVip:false,isPay:false};
  const chapters = finalizeChapterOrder([{...base,url:'https://example.org/1',nextChapterUrl:'https://old.example/'},{...base,url:'https://example.org/2',nextChapterUrl:'https://stale.example/'}],false,false);
  expect(chapters[0].nextChapterUrl).toBe('https://example.org/2');
  expect(chapters[1].nextChapterUrl).toBeUndefined();
});

test('library conversion preserves chapter pagination boundaries', () => {
  const { toLibraryBook } = require('../src/core/onlineLibrary');
  const info = {bookUrl:'https://example.org/book',origin:'https://example.org',originName:'源',name:'书',author:''};
  const base = {title:'章节',bookUrl:info.bookUrl,baseUrl:info.bookUrl,index:0,isVolume:false,isVip:false,isPay:false};
  const chapters = [{...base,url:'https://example.org/1',nextChapterUrl:'https://example.org/2'},{...base,url:'https://example.org/2'}];
  expect(toLibraryBook(info,chapters).chapters[0].nextChapterUrl).toBe('https://example.org/2');
});

test('builds a POST search request from an imported JavaScript JSON rule', async () => {
  const jsSource = {...source, bookSourceUrl:'https://api.example.com', searchUrl:`@js:"https://api.example.com/search," + JSON.stringify({method:"POST",body:"keyword={{key}}&page={{page-1}}"})`,ruleSearch:{bookList:'$.data[*]',name:'$.name',bookUrl:'$.url'}};
  globalThis.fetch = jest.fn().mockResolvedValue(response('{"data":[]}', 'https://api.example.com/search')) as jest.Mock;
  await searchSource(jsSource, '西游记', 3);
  const [url, options] = (globalThis.fetch as jest.Mock).mock.calls[0];
  expect(url).toBe('https://api.example.com/search');
  expect(options.method).toBe('POST');
  expect(options.body).toContain('page=2');
  expect(decodeURIComponent(options.body)).toContain('keyword=西游记');
});

test('expands search templates without rewriting the search term itself', () => {
  const { buildSourceRequest } = require('../src/core/sourceRequest');
  const request = buildSourceRequest(source, '/search?q={{key}}&page={{(page-1)*50}}', '$&searchPage', 3);
  expect(decodeURIComponent(request.url)).toContain('q=$&searchPage&page=100');
});

test('reports errors from JavaScript URL templates as script errors', () => {
  const { buildSourceRequest } = require('../src/core/sourceRequest');
  expect(() => buildSourceRequest(source, '/search,{"method":"POST","body":"x={{missingFunction()}}"}', '书', 1)).toThrow(/JavaScript/);
});

test('builds the original 1321 collection JSON search rule', async () => {
  const jsSource = {...source, bookSourceUrl:'https://api.midureader.com', searchUrl:`@js: "https://api.midureader.com/fiction/search/search," + JSON.stringify({"method":"POST","body":"app=midu&keyword={{key}}&page={{page-1}}"})`,ruleSearch:{bookList:'$.data[*]',name:'$.name',bookUrl:'$.url'}};
  globalThis.fetch = jest.fn().mockResolvedValue(response('{"data":[]}', 'https://api.midureader.com/fiction/search/search')) as jest.Mock;
  await searchSource(jsSource, '西游记', 3);
  const [url, options] = (globalThis.fetch as jest.Mock).mock.calls[0];
  expect(url).toBe('https://api.midureader.com/fiction/search/search');
  expect(options.method).toBe('POST');
  expect(decodeURIComponent(options.body)).toBe('app=midu&keyword=西游记&page=2');
});

test('runs the 7663 default source inline scripts before searching', async () => {
  const defaultSourceData = require('../src/assets/defaultBookSources.json');
  const defaultSource = {...parseBookSources(JSON.stringify(defaultSourceData))[0], concurrentRate:'0'};
  globalThis.fetch = jest.fn()
    .mockResolvedValueOnce(response('<form id="search" action="/search42.html"></form>', 'https://www.kkbiquge.net/'))
    .mockResolvedValueOnce(response('<div class="item"><dl><dt><a href="/book/1">西游记</a></dt></dl><div class="btm"><a>吴承恩</a></div></div>', 'https://www.kkbiquge.net/search42.html')) as jest.Mock;
  const books = await searchSource(defaultSource, '西游记');
  expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  expect((globalThis.fetch as jest.Mock).mock.calls[1][0]).toBe('https://www.kkbiquge.net/search42.html?searchkey=%E8%A5%BF%E6%B8%B8%E8%AE%B0');
  expect(decodeURIComponent((globalThis.fetch as jest.Mock).mock.calls[1][0])).toContain('西游记');
  expect(books).toHaveLength(1);
  expect(books[0]).toMatchObject({name:'西游记', author:'吴承恩'});
});

test('the 7663 directory rule extracts chapters from the source site anchor-and-dd structure', () => {
  const defaultSource = parseBookSources(JSON.stringify(require('../src/assets/defaultBookSources.json')))[0];
  const book = {bookUrl:'http://www.kkbiquge.net/123_456/',origin:defaultSource.bookSourceUrl,originName:defaultSource.bookSourceName,name:'测试书',author:''};
  const html = '<div id="list"><dl><dt>最新章节</dt><a href="/123_456/2.html"><dd>第二章</dd></a><dt>全部章节</dt><a href="/123_456/1.html"><dd>第一章</dd></a></dl></div>';
  expect(parseChapters(defaultSource, book, html, book.bookUrl).map(chapter => [chapter.title, chapter.url])).toEqual([
    ['第二章','http://www.kkbiquge.net/123_456/2.html'],
    ['第一章','http://www.kkbiquge.net/123_456/1.html'],
  ]);
});

test('the 7663 content rule follows the next page and stops at the final page', async () => {
  const defaultSource = {...parseBookSources(JSON.stringify(require('../src/assets/defaultBookSources.json')))[0],concurrentRate:'0'};
  const {loadChapterPayload} = require('../src/core/webBook');
  const base = 'http://www.kkbiquge.net/123_456/';
  globalThis.fetch = jest.fn()
    .mockResolvedValueOnce(response('<div id="chaptercontent"><div id="booktxt"><p>第一页正文</p></div></div><a id="next_url" href="2_2.html">下一页</a>', base+'2.html'))
    .mockResolvedValueOnce(response('<div id="chaptercontent"><div id="booktxt"><p>第二页正文</p></div></div><a id="next_url">没有了</a>', base+'2_2.html')) as jest.Mock;
  const chapter = {url:base+'2.html',title:'第二章',index:1,bookUrl:base,baseUrl:base};
  const result = await loadChapterPayload(defaultSource,chapter);
  expect(result.content).toContain('第一页正文');
  expect(result.content).toContain('第二页正文');
  expect(globalThis.fetch).toHaveBeenCalledTimes(2);
});

test('inline search expressions cannot request another source', async () => {
  const scripted = {...source, searchUrl:'{{java.ajax("https://other.example/")}}'};
  globalThis.fetch = jest.fn() as jest.Mock;
  await expect(searchSource(scripted, '书')).rejects.toThrow('JavaScript 请求地址不属于当前书源');
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test('inline request option scripts preserve literal search terms', async () => {
  const scripted = {...source, searchUrl:'/search,{"method":"POST","body":"q={{key}}&page={{page - 1}}"}',ruleSearch:{bookList:'$.data[*]',name:'$.name',bookUrl:'$.url'}};
  globalThis.fetch = jest.fn().mockResolvedValue(response('{"data":[]}', 'https://www.xsbook.org/search')) as jest.Mock;
  await searchSource(scripted, '$&searchPage', 3);
  const options = (globalThis.fetch as jest.Mock).mock.calls[0][1];
  expect(decodeURIComponent(options.body)).toBe('q=$&searchPage&page=2');
});

test('limits asynchronous requests across separate inline expressions', async () => {
  const scripted = {...source, searchUrl:Array(9).fill('{{java.ajax("/")}}').join('')};
  globalThis.fetch = jest.fn().mockResolvedValue(response('', 'https://www.xsbook.org/')) as jest.Mock;
  await expect(searchSource(scripted, '书')).rejects.toThrow('JavaScript 请求次数超过限制');
  expect(globalThis.fetch).toHaveBeenCalledTimes(8);
});

test('executes browser verification in a search URL script before using its suffix', async () => {
  const {sourceVerification} = require('../src/core/sourceVerification');
  const scripted = {...source, searchUrl:'<js>if(java.ajax(baseUrl)){java.startBrowserAwait(baseUrl,"验证",false);}</js>/search?key={{key}}',ruleSearch:{bookList:'$.data[*]',name:'$.name',bookUrl:'$.url'}};
  const fetcher = jest.spyOn(globalThis,'fetch')
    .mockResolvedValueOnce(response('challenge', 'https://www.xsbook.org/') as unknown as Response)
    .mockResolvedValueOnce(response('{"data":[]}', 'https://www.xsbook.org/search') as unknown as Response);
  fetcher.mockClear();
  const shown = jest.fn((request: {id:number;url:string}|null)=>{if(request) sourceVerification.finish(request.id,{url:request.url,html:'verified'});});
  const unsubscribe = sourceVerification.subscribe(shown);
  try {
    await searchSource(scripted, '西游记');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(shown).toHaveBeenCalledWith(expect.objectContaining({title:'验证'}));
    expect(decodeURIComponent(fetcher.mock.calls[1][0] as string)).toContain('/search?key=西游记');
  } finally {unsubscribe();jest.restoreAllMocks();}
});

test('evaluates browser verification in an inline URL expression', async () => {
  const {sourceVerification} = require('../src/core/sourceVerification');
  const scripted = {...source, searchUrl:'{{java.startBrowserAwait(baseUrl,"验证",false).body()}}',ruleSearch:{bookList:'$.data[*]',name:'$.name',bookUrl:'$.url'}};
  const fetcher = jest.spyOn(globalThis,'fetch').mockResolvedValue(response('{"data":[]}', 'https://www.xsbook.org/search') as unknown as Response);
  fetcher.mockClear();
  const unsubscribe = sourceVerification.subscribe((request: {id:number;url:string}|null)=>{if(request)sourceVerification.finish(request.id,{url:request.url,html:'/search?q=书'});});
  try {
    await searchSource(scripted,'书');
    expect(decodeURIComponent(fetcher.mock.calls[0][0] as string)).toContain('/search?q=书');
  } finally {unsubscribe();jest.restoreAllMocks();}
});

test('does not bypass side effects in an assigned @js search rule', async () => {
  const {sourceVerification} = require('../src/core/sourceVerification');
  const scripted = {...source, searchUrl:'@js:url="https://www.xsbook.org/search"; if(java.ajax(baseUrl)){java.startBrowserAwait(baseUrl,"验证",false);} result=url;',ruleSearch:{bookList:'$.data[*]',name:'$.name',bookUrl:'$.url'}};
  const fetcher = jest.spyOn(globalThis,'fetch')
    .mockResolvedValueOnce(response('challenge','https://www.xsbook.org/') as unknown as Response)
    .mockResolvedValueOnce(response('{"data":[]}', 'https://www.xsbook.org/search') as unknown as Response);
  fetcher.mockClear();
  const shown = jest.fn((request: {id:number;url:string}|null)=>{if(request)sourceVerification.finish(request.id,{url:request.url,html:'verified'});});
  const unsubscribe = sourceVerification.subscribe(shown);
  try {
    await searchSource(scripted,'书');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(shown).toHaveBeenCalledWith(expect.objectContaining({title:'验证'}));
  } finally {unsubscribe();jest.restoreAllMocks();}
});

test('passes each search URL script its preceding result in native order', async () => {
  const scripted = {...source, searchUrl:'/search<js>result + "?q=" + java.encodeURI(key);</js><js>result + "&page=" + page;</js>',ruleSearch:{bookList:'$.data[*]',name:'$.name',bookUrl:'$.url'}};
  const fetcher = jest.spyOn(globalThis,'fetch').mockResolvedValue(response('{"data":[]}', 'https://www.xsbook.org/search') as unknown as Response);
  fetcher.mockClear();
  try {
    await searchSource(scripted, '西游记', 2);
    expect(decodeURIComponent(fetcher.mock.calls[0][0] as string)).toContain('/search?q=西游记&page=2');
  } finally {jest.restoreAllMocks();}
});

test('rejects cross-source browser URLs from search scripts', async () => {
  const scripted = {...source, searchUrl:'@js:java.startBrowserAwait("https://other.example/", "验证", false).body();'};
  await expect(searchSource(scripted,'书')).rejects.toThrow(/浏览器验证地址不属于当前书源/);
});
