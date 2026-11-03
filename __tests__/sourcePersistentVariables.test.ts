const mockValues = new Map<string,string|number>();
jest.mock('../src/data/storage', () => ({appStorage:{
  getString:(key:string)=>typeof mockValues.get(key)==='string'?mockValues.get(key):undefined,
  getAllKeys:()=>[...mockValues.keys()],set:(key:string,value:string)=>mockValues.set(key,value),
  remove:(key:string)=>mockValues.delete(key),
}}));
import {searchSource,parseChapters} from '../src/core/webBook';
import type {BookSource} from '../src/types';
import fixture from './fixtures/source-1321-quanben-search.json';

const cacheKey='legacy.runtime-source-cache.v1';
const source: BookSource = {...fixture,bookSourceType:0,
  customOrder:0,enabled:true,enabledExplore:true,
  ruleSearch:{bookList:'div.item',name:'a@text',bookUrl:'a@href'}};
const response=(url:string)=>({ok:true,status:200,url,headers:{get:()=>null,forEach:()=>{}},text:async()=>'<div class="item"><a href="/1">书</a></div>'});
beforeEach(()=>mockValues.clear());
afterEach(()=>jest.restoreAllMocks());

test('runs the original 1321 search URL using a restored source variable', async () => {
  mockValues.set(cacheKey,JSON.stringify([{key:`sourceVariable_${source.bookSourceUrl}`,value:'https://mirror.example/',deadline:0}]));
  const fetcher=jest.spyOn(globalThis,'fetch').mockImplementation(async address=>response(String(address)) as unknown as Response);
  const books=await searchSource(source,'西游记');
  expect(decodeURIComponent(String(fetcher.mock.calls[0][0]))).toBe('https://mirror.example/index.php?c=book&a=search&keywords=西游记');
  expect(books[0].name).toBe('书');
});

test('original search URL falls back to the source key when its variable is absent', async () => {
  const fetcher=jest.spyOn(globalThis,'fetch').mockImplementation(async address=>response(String(address)) as unknown as Response);
  await searchSource(source,'西游记');
  expect(decodeURIComponent(String(fetcher.mock.calls[0][0]))).toBe('https://www.quanben.io/index.php?c=book&a=search&keywords=西游记');
});

test('source variables persist across search and chapter scripts without crossing sources', async () => {
  const scripted={...source,searchUrl:'@js:source.put("key",key); source.setVariable("route"); "/search"',
    ruleSearch:{...source.ruleSearch,name:'@js:source.get("key")+":"+source.getVariable()'}};
  jest.spyOn(globalThis,'fetch').mockImplementation(async address=>response(String(address)) as unknown as Response);
  const [book]=await searchSource(scripted,'关键词');
  expect(book.name).toBe('关键词:route');
  const toc={...scripted,ruleToc:{chapterList:'$.items[*]',chapterName:'@js:java.get("key")+":"+source.getVariable()',chapterUrl:'$.url'}};
  expect(parseChapters(toc,book,{items:[{url:'/1'}]},source.bookSourceUrl)[0].title).toBe('关键词:route');
  const other={...toc,bookSourceUrl:'https://other.example'};
  expect(parseChapters(other,book,{items:[{url:'/2'}]},other.bookSourceUrl)[0].title).toBe(':');
  const rows=JSON.parse(String(mockValues.get(cacheKey)));
  expect(rows).toEqual(expect.arrayContaining([{key:`v_${source.bookSourceUrl}_key`,value:'关键词',deadline:0},{key:`sourceVariable_${source.bookSourceUrl}`,value:'route',deadline:0}]));
});

test('writing a source variable never overwrites damaged existing cache data', async () => {
  mockValues.set(cacheKey,'{damaged');
  const scripted={...source,searchUrl:'@js:source.put("key","value"); "/search"'};
  await expect(searchSource(scripted,'书')).rejects.toThrow();
  expect(mockValues.get(cacheKey)).toBe('{damaged');
});

test('writing a source variable does not overwrite an existing cache of the wrong storage type', async () => {
  mockValues.set(cacheKey,123);
  const scripted={...source,searchUrl:'@js:source.put("key","value"); "/search"'};
  await expect(searchSource(scripted,'书')).rejects.toThrow();
  expect(mockValues.get(cacheKey)).toBe(123);
});

test('clearing the whole-source variable preserves other cache records', async () => {
  mockValues.set(cacheKey,JSON.stringify([{key:`sourceVariable_${source.bookSourceUrl}`,value:'route',deadline:0},{key:'v_other_test',value:'untouched',deadline:0}]));
  const scripted={...source,searchUrl:'@js:source.putVariable(null); "/search"'};
  jest.spyOn(globalThis,'fetch').mockImplementation(async address=>response(String(address)) as unknown as Response);
  await searchSource(scripted,'书');
  expect(JSON.parse(String(mockValues.get(cacheKey)))).toEqual([{key:'v_other_test',value:'untouched',deadline:0}]);
});
