jest.mock('../src/data/storage',()=>({appStorage:{getString:jest.fn(),set:jest.fn(),remove:jest.fn()}}));
import {exploreSource,loadBookInfo,loadChapters,loadChapterPayload} from '../src/core/webBook';
import {runSourceJavaScriptAsync,type SourceJavaScriptBridge} from '../src/core/sourceJavaScript';
import type {BookSource,SearchBook,BookChapter} from '../src/types';

const source:BookSource={bookSourceUrl:'https://example.org',bookSourceName:'测试源',bookSourceType:0,customOrder:0,enabled:true,enabledExplore:true,loginCheckJs:'result;',ruleExplore:{bookList:'div.item',name:'a@text',bookUrl:'a@href'},ruleBookInfo:{intro:'p@text'},ruleToc:{chapterList:'div.item',chapterName:'a@text',chapterUrl:'a@href'},ruleContent:{content:'p@text',nextContentUrl:'a#next@href'}};
const book:SearchBook={bookUrl:'https://example.org/book',tocUrl:'https://example.org/toc',origin:source.bookSourceUrl,originName:source.bookSourceName,name:'书',author:''};
const chapter:BookChapter={url:'https://example.org/chapter',title:'第一章',index:0,bookUrl:book.bookUrl,baseUrl:book.bookUrl,isVolume:false,isVip:false,isPay:false};
const response=(body:string,url:string)=>({ok:true,status:200,url,headers:{get:()=>null,forEach:()=>{}},text:async()=>body});
const runner=()=>jest.fn((script:string,bridge:SourceJavaScriptBridge,input?:unknown,_signal?:AbortSignal)=>runSourceJavaScriptAsync(script,bridge,input));
afterEach(()=>jest.restoreAllMocks());

test.each(['explore','detail','toc','content'] as const)('the %s request uses the provided login runner and signal',async flow=>{
  const controller=new AbortController(),run=runner();
  jest.spyOn(globalThis,'fetch').mockResolvedValue(response('<div class="item"><a href="/chapter">第一章</a></div><p>正文</p>','https://example.org/page') as unknown as Response);
  if(flow==='explore') await exploreSource(source,{title:'发现',url:'/explore'},1,{runJavaScript:run,signal:controller.signal});
  if(flow==='detail') await loadBookInfo(source,{...book},controller.signal,{runJavaScript:run});
  if(flow==='toc') await loadChapters(source,{...book},controller.signal,{runJavaScript:run});
  if(flow==='content') await loadChapterPayload(source,{...chapter},{runJavaScript:run,signal:controller.signal});
  expect(run).toHaveBeenCalledTimes(1);
  expect(run.mock.calls[0][0]).toBe('result;');
  expect(run.mock.calls[0][3]).toBe(controller.signal);
});

test('each content page runs the injected login check',async()=>{
  const run=runner();
  jest.spyOn(globalThis,'fetch').mockResolvedValueOnce(response('<p>第一页</p><a id="next" href="/chapter2">下页</a>','https://example.org/chapter') as unknown as Response)
    .mockResolvedValueOnce(response('<p>第二页</p>','https://example.org/chapter2') as unknown as Response);
  const result=await loadChapterPayload(source,chapter,{runJavaScript:run});
  expect(result.content).toContain('第一页');expect(result.content).toContain('第二页');expect(run).toHaveBeenCalledTimes(2);
});

test.each(['explore','content'] as const)('the %s request does not start after cancellation',async flow=>{
  const controller=new AbortController();controller.abort();
  const fetcher=jest.spyOn(globalThis,'fetch');
  const promise=flow==='explore'?exploreSource(source,{title:'发现',url:'/explore'},1,{signal:controller.signal}):loadChapterPayload(source,chapter,{signal:controller.signal});
  await expect(promise).rejects.toMatchObject({name:'AbortError'});expect(fetcher).not.toHaveBeenCalled();
});
