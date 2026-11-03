jest.mock('../src/data/storage',()=>({appStorage:{getString:jest.fn(),set:jest.fn(),remove:jest.fn()}}));
import defaults from '../src/assets/defaultBookSources.json';
import {parseBookSources} from '../src/data/sources';
import {searchSource} from '../src/core/webBook';
import {runSourceJavaScriptAsync, type SourceJavaScriptBridge} from '../src/core/sourceJavaScript';

const response=(body:string,url:string)=>({ok:true,status:200,url,headers:{get:()=>null,forEach:()=>{}},text:async()=>body});
afterEach(()=>jest.restoreAllMocks());

test('search sends URL expressions and login checks through the supplied runner', async () => {
  const source={...parseBookSources(JSON.stringify(defaults))[0],concurrentRate:'0'};
  jest.spyOn(globalThis,'fetch')
    .mockResolvedValueOnce(response('<form id="search" action="/search42.html"></form>','https://www.kkbiquge.net/') as unknown as Response)
    .mockResolvedValueOnce(response('<div class="item"><dl><dt><a href="/book/1">西游记</a></dt></dl><div class="btm"><a>吴承恩</a></div></div>','https://www.kkbiquge.net/search42.html') as unknown as Response);
  const run=jest.fn((script:string,bridge:SourceJavaScriptBridge,input?:unknown,_signal?:AbortSignal)=>runSourceJavaScriptAsync(script,bridge,input));
  const controller=new AbortController();
  const books=await searchSource(source,'西游记',1,controller.signal,{runJavaScript:run});
  expect(books[0]).toMatchObject({name:'西游记',author:'吴承恩'});
  expect(run).toHaveBeenCalledTimes(3);
  expect(run.mock.calls.every(call=>call[3]===controller.signal)).toBe(true);
  expect(run.mock.calls[2][0]).toBe(defaults[0].loginCheckJs);
});

test('the injected login runner cannot forge a response object', async () => {
  const source={...parseBookSources(JSON.stringify(defaults))[0],searchUrl:'/search',loginCheckJs:'result;',concurrentRate:'0'};
  jest.spyOn(globalThis,'fetch').mockResolvedValue(response('body','https://www.kkbiquge.net/search') as unknown as Response);
  const run=jest.fn(async()=>({data:'fake',body:'fake',url:source.bookSourceUrl,code:200}));
  await expect(searchSource(source,'书',1,undefined,{runJavaScript:run})).rejects.toThrow(/必须返回响应对象/);
});

test('the injected runner receives the previous result for a full URL script block', async () => {
  const source={...parseBookSources(JSON.stringify(defaults))[0],searchUrl:'<js>baseUrl + "/search?word=" + key</js>',loginCheckJs:'result;',concurrentRate:'0'};
  jest.spyOn(globalThis,'fetch').mockResolvedValue(response('<div class="item"><dl><dt><a href="/book/1">西游记</a></dt></dl><div class="btm"><a>吴承恩</a></div></div>','https://www.kkbiquge.net/search') as unknown as Response);
  const run=jest.fn((script:string,bridge:SourceJavaScriptBridge,input?:unknown,_signal?:AbortSignal)=>runSourceJavaScriptAsync(script,bridge,input));
  const books=await searchSource(source,'西游记',1,undefined,{runJavaScript:run});
  expect(books[0].name).toBe('西游记');
  expect(run).toHaveBeenCalledTimes(2);
  expect(run.mock.calls[0][2]).toBe(source.searchUrl);
});
