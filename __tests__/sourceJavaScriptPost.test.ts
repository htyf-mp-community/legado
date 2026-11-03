jest.mock('../src/data/storage', () => ({appStorage:{getString:jest.fn(),set:jest.fn(),remove:jest.fn()}}));
const mockNitroFetch = jest.fn();
jest.mock('react-native-nitro-fetch', () => ({fetch: (...args: unknown[]) => mockNitroFetch(...args)}), {virtual:true});

import {searchSource} from '../src/core/webBook';
import {runSourceJavaScriptAsync} from '../src/core/sourceJavaScript';
import type {BookSource} from '../src/types';
import fixture from './fixtures/source-post-1321-wuyou.json';
import templateFixture from './fixtures/source-post-1321-weishuxiang.json';
import * as httpLog from '../src/data/httpLog';
import {appStorage} from '../src/data/storage';

const source: BookSource = {
  bookSourceUrl:'https://example.org',bookSourceName:fixture.bookSourceName,bookSourceType:0,customOrder:0,
  enabled:true,enabledExplore:true,searchUrl:fixture.searchUrl,
  ruleSearch:{bookList:'div.item',name:'a@text',bookUrl:'a@href'},
};
const response = (body: string, url: string, status = 200, headers: Record<string,string> = {}) => ({
  ok: status >= 200 && status < 300, status, url,
  headers:{get:(name: string) => Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1] ?? null,
    forEach:(fn: (value: string, key: string) => void) => Object.entries(headers).forEach(([key,value]) => fn(value,key))},
  text:async () => body,
});
beforeEach(() => mockNitroFetch.mockReset());
afterEach(() => { jest.restoreAllMocks(); (appStorage.getString as jest.Mock).mockReset(); });

test('runs the actual 无忧小说 search POST and uses its redirect location', async () => {
  mockNitroFetch.mockResolvedValueOnce(response('', 'https://example.org/search.html', 302, {Location:'/search/1.html'}));
  const fetcher = jest.spyOn(globalThis,'fetch').mockResolvedValueOnce(response('<div class="item"><a href="/book">西游记</a></div>', 'https://example.org/search/2.html') as unknown as Response);
  const books = await searchSource(source, '西游记', 2);
  expect(books.map(book => book.name)).toEqual(['西游记']);
  expect(mockNitroFetch).toHaveBeenCalledTimes(1);
  expect(mockNitroFetch).toHaveBeenCalledWith('https://example.org/search.html', expect.objectContaining({
    method:'POST', redirect:'manual', body:'searchtype=all&searchkey=西游记',
    headers:expect.objectContaining({Referer:'https://example.org','Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'}),
  }));
  expect(fetcher).toHaveBeenCalledWith('https://example.org/search/2.html', expect.objectContaining({method:'GET'}));
});

test('runs the actual 伪书香 template-string POST search rule', async () => {
  mockNitroFetch.mockResolvedValueOnce(response('', 'https://example.org/e/search/index.php', 302, {Location:'/e/search/result/index.php?searchid=42'}));
  const fetcher = jest.spyOn(globalThis,'fetch').mockResolvedValueOnce(response('<div class="item"><a href="/book">西游记</a></div>', 'https://example.org/e/search/result/index.php?page=1&searchid=42') as unknown as Response);
  const books = await searchSource({...source,searchUrl:templateFixture.searchUrl}, '西游记', 2);
  expect(books.map(book => book.name)).toEqual(['西游记']);
  expect(mockNitroFetch).toHaveBeenCalledWith('https://example.org/e/search/index.php', expect.objectContaining({
    method:'POST',body:'show=title,softwriter&keyboard=西游记&tbname=download&tempid=1',
  }));
  expect(fetcher).toHaveBeenCalledWith('https://example.org/e/search//e/search/result/index.php?page=1&searchid=42', expect.objectContaining({method:'GET'}));
});

test('exposes the response body, status, and case-insensitive headers to scripts', async () => {
  const post = jest.fn().mockResolvedValue({data:'ok',body:'ok',url:'https://example.org/post',code:302,headers:{location:'/next'}});
  const bridge = {baseUrl:source.bookSourceUrl,key:null,page:1,ajax:async()=>'',removeCookie:()=>{},post};
  const result = await runSourceJavaScriptAsync('var r=java.post(baseUrl+"/post","a=1",{"X-Test":"yes"},1000);r.body()+":"+r.statusCode()+":"+r.header("Location");',bridge);
  expect(result).toBe('ok:302:/next');
  expect(post).toHaveBeenCalledWith('https://example.org/post','a=1',{'X-Test':'yes'},1000);
});

test('rejects cross-source POST before sending any request', async () => {
  const bad = {...source,searchUrl:'@js:java.post("https://other.example/post","x",{}).body()'};
  await expect(searchSource(bad,'书')).rejects.toThrow(/不属于当前书源/);
  expect(mockNitroFetch).not.toHaveBeenCalled();
});

test('does not retry or upgrade a POST that returns an HTTP error', async () => {
  mockNitroFetch.mockResolvedValueOnce(response('error','http://example.org/post',500));
  const failed = {...source,bookSourceUrl:'http://example.org',searchUrl:'@js:java.post(baseUrl+"/post","x",{}).body()'};
  await expect(searchSource(failed,'书')).rejects.toThrow(/HTTP 500/);
  expect(mockNitroFetch).toHaveBeenCalledTimes(1);
  expect(mockNitroFetch.mock.calls[0][0]).toBe('http://example.org/post');
});

test('lets a source recover from an HTTP error in its search script', async () => {
  mockNitroFetch.mockResolvedValueOnce(response('error','https://example.org/post',500));
  const scripted = {...source,searchUrl:'@js:try{java.post(baseUrl+"/post","x",{});"/unexpected"}catch(e){"/search"}'};
  const fetcher = jest.spyOn(globalThis,'fetch').mockResolvedValueOnce(response('<div class="item"><a href="/book">恢复</a></div>','https://example.org/search') as unknown as Response);
  expect((await searchSource(scripted,'书')).map(book => book.name)).toEqual(['恢复']);
  expect(mockNitroFetch).toHaveBeenCalledTimes(1);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test('merges source cookies with explicit POST cookies when the jar is enabled', async () => {
  (appStorage.getString as jest.Mock).mockImplementation((key: string) => key.startsWith('source-cookie.v1.') ? '{"saved":"one","replace":"old"}' : undefined);
  mockNitroFetch.mockResolvedValueOnce(response('', 'https://example.org/post', 302, {Location:'/search'}));
  const scripted = {...source,enabledCookieJar:true,searchUrl:'@js:java.post(baseUrl+"/post","x",{"Cookie":"replace=new"}).header("Location")'};
  jest.spyOn(globalThis,'fetch').mockResolvedValueOnce(response('{"data":[]}', 'https://example.org/search') as unknown as Response);
  await searchSource(scripted,'书');
  expect(mockNitroFetch.mock.calls[0][1].headers.Cookie).toBe('saved=one; replace=new');
});

test('keeps POST credentials and response data out of HTTP logs', async () => {
  const log = jest.spyOn(httpLog, 'addHttpLog').mockImplementation(() => null);
  mockNitroFetch.mockResolvedValueOnce(response('private-token', 'https://example.org/post', 200, {'Set-Cookie':'session=secret'}));
  const scripted = {...source,searchUrl:'@js:java.post(baseUrl+"/post","password=secret",{"Authorization":"Bearer secret"}).body(); "/search";'};
  jest.spyOn(globalThis,'fetch').mockResolvedValueOnce(response('{"data":[]}', 'https://example.org/search') as unknown as Response);
  await searchSource(scripted,'书');
  const entry = log.mock.calls.find(([value]) => value.method === 'POST')?.[0];
  expect(entry).toMatchObject({requestBody:'[REDACTED]',responseBody:'[REDACTED]',requestHeaders:expect.objectContaining({Authorization:'[REDACTED]'}),responseHeaders:{'Set-Cookie':'[REDACTED]'}});
});

test('propagates cancellation to the in-flight POST', async () => {
  const controller = new AbortController();
  let notifyStarted!: () => void;
  const started = new Promise<void>(resolve => {notifyStarted = resolve;});
  mockNitroFetch.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
    notifyStarted();
    options.signal.addEventListener('abort', () => reject(new Error('aborted')), {once:true});
  }));
  const scripted = {...source,searchUrl:'@js:java.post(baseUrl+"/post","x",{}).body()'};
  const result = searchSource(scripted,'书',1,controller.signal);
  await started;
  controller.abort();
  await expect(result).rejects.toThrow(/取消|abort/i);
  expect(mockNitroFetch).toHaveBeenCalledTimes(1);
});
