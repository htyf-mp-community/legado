jest.mock('../src/data/storage', () => ({appStorage:{getString:jest.fn(),set:jest.fn(),remove:jest.fn()}}));
import {searchSource, exploreSource, loadBookInfo, loadChapters, loadChapterPayload} from '../src/core/webBook';
import {sourceVerification} from '../src/core/sourceVerification';
import jssdk from '@htyf-mp/js-sdk';
import type {BookSource, SearchBook, BookChapter} from '../src/types';

const source: BookSource = {bookSourceUrl:'https://example.org',bookSourceName:'登录检查',bookSourceType:0,customOrder:0,enabled:true,enabledExplore:true,searchUrl:'/search',ruleSearch:{bookList:'div.item',name:'a@text',bookUrl:'a@href'},ruleExplore:{bookList:'div.item',name:'a@text',bookUrl:'a@href'},ruleBookInfo:{name:'h1@text'},ruleToc:{chapterList:'div.item',chapterName:'a@text',chapterUrl:'a@href'},ruleContent:{content:'p@text'}};
const book: SearchBook = {bookUrl:'https://example.org/book',tocUrl:'https://example.org/toc',origin:source.bookSourceUrl,originName:source.bookSourceName,name:'书',author:''};
const chapter: BookChapter = {url:'https://example.org/chapter',title:'章',index:0,bookUrl:book.bookUrl,baseUrl:book.bookUrl,isVolume:false,isVip:false,isPay:false};
const response = (body: string, url: string) => ({ok:true,status:200,url,headers:{get:()=>null,forEach:()=>{}},text:async()=>body});
afterEach(() => jest.restoreAllMocks());

test('executes the actual 7663 login check on normal search responses', async () => {
  const check = require('../src/assets/defaultBookSources.json')[0].loginCheckJs;
  const fetcher = jest.spyOn(globalThis,'fetch').mockResolvedValue(response('<div class="item"><a href="/book">书</a></div>','https://example.org/search') as unknown as Response);
  const books = await searchSource({...source,loginCheckJs:check},'书');
  expect(books.map(book => book.name)).toEqual(['书']);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test('replaces a response with a same-source java.connect result', async () => {
  const check = 'if (result.body() === "retry") result = java.connect(result.url() + "?retry=1"); result;';
  const fetcher = jest.spyOn(globalThis,'fetch').mockResolvedValueOnce(response('retry','https://example.org/search') as unknown as Response).mockResolvedValueOnce(response('<div class="item"><a href="/book">重试成功</a></div>','https://example.org/search?retry=1') as unknown as Response);
  const books = await searchSource({...source,loginCheckJs:check},'书');
  expect(books.map(book => book.name)).toEqual(['重试成功']);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test('accepts a synthetic connect response when the network request fails', async () => {
  const check = 'var r=java.connect(baseUrl+"/offline");if(r.code()!==200||r.url()!==baseUrl+"/offline"||r.body().indexOf("offline")<0)throw "bad response";r;';
  jest.spyOn(globalThis,'fetch')
    .mockResolvedValueOnce(response('<div class="item"><a href="/book">书</a></div>','https://example.org/search') as unknown as Response)
    .mockRejectedValueOnce(new Error('offline'));
  expect(await searchSource({...source,loginCheckJs:check},'书')).toEqual([]);
});

test('login scripts receive the search key, page and source identity', async () => {
  const check = 'if (key !== "书" || page !== 3 || source.getKey() !== "https://example.org" || source.bookSourceUrl !== "https://example.org") throw "bad context"; result;';
  jest.spyOn(globalThis,'fetch').mockResolvedValue(response('<div class="item"><a href="/book">书</a></div>','https://example.org/search') as unknown as Response);
  expect((await searchSource({...source,loginCheckJs:check},'书',3))[0].name).toBe('书');
});

test('does not accept a script-created object as a network response', async () => {
  jest.spyOn(globalThis,'fetch').mockResolvedValue(response('','https://example.org/search') as unknown as Response);
  await expect(searchSource({...source,loginCheckJs:'({body:"x",url:"https://example.org",code:200});'},'书')).rejects.toThrow(/必须返回响应对象/);
});

test('does not allow login scripts to connect to another source', async () => {
  const fetcher = jest.spyOn(globalThis,'fetch').mockResolvedValue(response('','https://example.org/search') as unknown as Response);
  await expect(searchSource({...source,loginCheckJs:'java.connect("https://other.org/");'},'书')).rejects.toThrow(/不属于当前书源/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test('waits for browser verification and retries the original response', async () => {
  const check = require('../src/assets/defaultBookSources.json')[0].loginCheckJs;
  const fetcher = jest.spyOn(globalThis,'fetch')
    .mockResolvedValueOnce(response('<script>window.location="/challenge"</script>','https://example.org/search') as unknown as Response)
    .mockResolvedValueOnce(response('verified','https://example.org/') as unknown as Response)
    .mockResolvedValueOnce(response('<div class="item"><a href="/book">验证后的书</a></div>','https://example.org/search') as unknown as Response);
  const unsubscribe = sourceVerification.subscribe(request => {
    if (request) sourceVerification.finish(request.id, {url:request.url,html:'verified'});
  });
  try {
    expect((await searchSource({...source,loginCheckJs:check},'书'))[0].name).toBe('验证后的书');
    expect(fetcher).toHaveBeenCalledTimes(3);
  } finally { unsubscribe(); }
});

test('returns browser HTML without refetching when the script requests it', async () => {
  const check = 'result = java.startBrowserAwait(source.getKey(), "验证", false); result;';
  const fetcher = jest.spyOn(globalThis,'fetch').mockResolvedValueOnce(response('challenge','https://example.org/search') as unknown as Response);
  const unsubscribe = sourceVerification.subscribe(request => {
    if (request) sourceVerification.finish(request.id, {url:'https://example.org/verified',html:'<div class="item"><a href="/book">浏览器返回</a></div>'});
  });
  try {
    expect((await searchSource({...source,loginCheckJs:check},'书'))[0].name).toBe('浏览器返回');
    expect(fetcher).toHaveBeenCalledTimes(1);
  } finally { unsubscribe(); }
});

test('cancelling browser verification cancels the waiting search', async () => {
  const check = require('../src/assets/defaultBookSources.json')[0].loginCheckJs;
  jest.spyOn(globalThis,'fetch').mockResolvedValue(response('<script>window.challenge=true</script>','https://example.org/search') as unknown as Response);
  const unsubscribe = sourceVerification.subscribe(request => { if (request) sourceVerification.cancel(request.id); });
  try { await expect(searchSource({...source,loginCheckJs:check},'书')).rejects.toThrow(/验证已取消/); }
  finally { unsubscribe(); }
});

test.each([
  ['explore', () => exploreSource({...source,loginCheckJs:'throw "login check ran";'}, {title:'发现',url:'/explore'})],
  ['details', () => loadBookInfo({...source,loginCheckJs:'throw "login check ran";'},book)],
  ['contents', () => loadChapters({...source,loginCheckJs:'throw "login check ran";'},book)],
  ['chapter', () => loadChapterPayload({...source,loginCheckJs:'throw "login check ran";'},chapter)],
])('runs login check for %s responses', async (_name, run) => {
  jest.spyOn(globalThis,'fetch').mockResolvedValue(response('<p>正文</p>','https://example.org/page') as unknown as Response);
  await expect(run()).rejects.toThrow(/login check ran/);
});

test('login check can recover an HTTP 403 using the actual response body and status', async () => {
  const check = 'if(result.code()===403 && result.body().indexOf("challenge")>=0) result=java.connect(result.url()); result;';
  const fetcher = jest.spyOn(globalThis,'fetch')
    .mockResolvedValueOnce({...response('challenge','https://example.org/search'),ok:false,status:403} as unknown as Response)
    .mockResolvedValueOnce(response('<div class="item"><a href="/book">验证通过</a></div>','https://example.org/search') as unknown as Response);
  expect((await searchSource({...source,loginCheckJs:check},'书'))[0].name).toBe('验证通过');
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test('the 7663 check opens verification for an HTTP 403 challenge and retries', async () => {
  const check = require('../src/assets/defaultBookSources.json')[0].loginCheckJs;
  const fetcher = jest.spyOn(globalThis,'fetch')
    .mockResolvedValueOnce({...response('<script>window.challenge=true</script>','https://example.org/search'),ok:false,status:403} as unknown as Response)
    .mockResolvedValueOnce(response('verified','https://example.org/') as unknown as Response)
    .mockResolvedValueOnce(response('<div class="item"><a href="/book">403 验证通过</a></div>','https://example.org/search') as unknown as Response);
  const unsubscribe = sourceVerification.subscribe(request => {if (request) sourceVerification.finish(request.id,{url:request.url,html:'verified'});});
  try {
    expect((await searchSource({...source,loginCheckJs:check},'书'))[0].name).toBe('403 验证通过');
    expect(fetcher).toHaveBeenCalledTimes(3);
  } finally { unsubscribe(); }
});

test('runs the original 1321 霹雳书屋 login check and displays its long toast', async () => {
  const fixture = require('./fixtures/source-login-1321-pilishuwu.json');
  const scripted = {...source,...fixture};
  const toast = jest.spyOn(jssdk,'showToast').mockResolvedValue(()=>{});
  const fetcher = jest.spyOn(globalThis,'fetch').mockResolvedValueOnce({...response('Just a moment','https://www.pilishuwu.com/search'),ok:false,status:403} as unknown as Response);
  const shown = jest.fn((request: {id:number;url:string}|null)=>{if(request)sourceVerification.finish(request.id,{url:request.url,html:'<div class="item"><a href="/book">验证后的书</a></div>'});});
  const unsubscribe = sourceVerification.subscribe(shown);
  try {
    expect((await searchSource(scripted,'书'))[0].name).toBe('验证后的书');
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({title:'📂霹雳书屋: 请完成人机验证后点右上角对勾',duration:3500}));
    expect(shown).toHaveBeenCalledWith(expect.objectContaining({title:'Cloudflare验证',refetch:false}));
    expect(fetcher).toHaveBeenCalledTimes(1);
  } finally {unsubscribe();}
});

test('login check sees a synthetic status 500 on network failure and may recover', async () => {
  const check = 'if(result.code()===500 && result.body().indexOf("offline fixture")>=0) result=java.connect(result.url()); result;';
  const fetcher = jest.spyOn(globalThis,'fetch').mockRejectedValueOnce(new Error('offline fixture'))
    .mockResolvedValueOnce(response('<div class="item"><a href="/book">恢复成功</a></div>','https://example.org/search') as unknown as Response);
  expect((await searchSource({...source,loginCheckJs:check},'书'))[0].name).toBe('恢复成功');
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test('preserves the original network error if the error response is returned unchanged', async () => {
  const original = new Error('offline fixture');
  jest.spyOn(globalThis,'fetch').mockRejectedValueOnce(original);
  await expect(searchSource({...source,loginCheckJs:'result;'},'书')).rejects.toBe(original);
});

test('preserves the original network error if the fallback login check itself fails', async () => {
  const original = new Error('offline fixture');
  jest.spyOn(globalThis,'fetch').mockRejectedValueOnce(original);
  await expect(searchSource({...source,loginCheckJs:'throw "bad fallback";'},'书')).rejects.toBe(original);
});

test('retries a failed login check with a synthetic error response', async () => {
  const check = 'if(result.code()===200) throw "bad first check"; if(result.code()===500) result=java.connect(result.url()); result;';
  jest.spyOn(globalThis,'fetch').mockResolvedValueOnce(response('initial','https://example.org/search') as unknown as Response)
    .mockResolvedValueOnce(response('<div class="item"><a href="/book">脚本恢复</a></div>','https://example.org/search') as unknown as Response);
  expect((await searchSource({...source,loginCheckJs:check},'书'))[0].name).toBe('脚本恢复');
});

test('does not execute recovery after the search is cancelled', async () => {
  const controller = new AbortController();
  const fetcher = jest.spyOn(globalThis,'fetch').mockImplementation(async () => {controller.abort(); throw new Error('cancelled network');});
  await expect(searchSource({...source,loginCheckJs:'java.connect(result.url());'},'书',1,controller.signal)).rejects.toMatchObject({name:'AbortError'});
  expect(fetcher).toHaveBeenCalledTimes(1);
});
