jest.mock('../src/data/storage',()=>({appStorage:{getString:jest.fn(),set:jest.fn(),remove:jest.fn()}}));
import {loadBookInfo, searchSource} from '../src/core/webBook';
import {toLibraryBook} from '../src/core/onlineLibrary';
import type {BookSource} from '../src/types';
const fixture = require('./fixtures/source-search-1321-xiaoxiao.json');
const source: BookSource = {...fixture,bookSourceType:0,customOrder:0,enabled:true,enabledExplore:true,
  loginCheckJs:'if(java.get("key") !== key) throw "missing search variable"; result;',
  ruleSearch:{bookList:'div.item',name:'@js:java.get("key") + ":" + result.text()',author:'@js:java.get("key")',bookUrl:'a@href'}};
const response = (body:string,url:string)=>({ok:true,status:200,url,headers:{get:()=>null,forEach:()=>{}},text:async()=>body});
afterEach(()=>jest.restoreAllMocks());

test('shares the original 1321 search URL variable with login and book rules', async () => {
  const fetcher=jest.spyOn(globalThis,'fetch').mockResolvedValue(response('<div class="item"><a href="/book">书名</a></div>',source.bookSourceUrl+'/search') as unknown as Response);
  const [book]=await searchSource(source,'深空彼岸');
  expect(decodeURIComponent(fetcher.mock.calls[0][0] as string)).toContain('keyword=深空彼岸');
  expect(book).toMatchObject({name:'深空彼岸:书名',author:'深空彼岸'});
  expect(JSON.parse(book.variable!)).toMatchObject({key:'深空彼岸'});
  expect(toLibraryBook(book,[]).variable).toBe(book.variable);
});

test('shares variables between separate inline URL expressions', async () => {
  const scripted={...source,searchUrl:'/search?key={{java.put("key",key)}}&copy={{java.get("key")}}'};
  const fetcher=jest.spyOn(globalThis,'fetch').mockResolvedValue(response('<div class="item"><a href="/book">书名</a></div>',source.bookSourceUrl+'/search') as unknown as Response);
  await searchSource(scripted,'西游记');
  expect(decodeURIComponent(fetcher.mock.calls[0][0] as string)).toContain('key=西游记&copy=西游记');
});

test('book detail and its login check retain search variables', async () => {
  const scripted={...source,loginCheckJs:'if(java.get("key")!=="深空彼岸")throw "missing variable"; result;',ruleBookInfo:{intro:'@js:java.put("detail",java.get("key"))'}};
  jest.spyOn(globalThis,'fetch')
    .mockResolvedValueOnce(response('<div class="item"><a href="/book">书名</a></div>',source.bookSourceUrl+'/search') as unknown as Response)
    .mockResolvedValueOnce(response('<p>详情</p>',source.bookSourceUrl+'/book') as unknown as Response);
  const [book]=await searchSource(scripted,'深空彼岸');
  const detail=await loadBookInfo(scripted,book);
  expect(detail.intro).toBe('深空彼岸');
  expect(JSON.parse(detail.variable!)).toEqual({key:'深空彼岸',detail:'深空彼岸'});
  expect(JSON.parse(book.variable!)).toEqual({key:'深空彼岸'});
});

test('concurrent searches keep their variables isolated', async () => {
  jest.spyOn(globalThis,'fetch').mockImplementation(async url=>response('<div class="item"><a href="/book">书名</a></div>',String(url)) as unknown as Response);
  const [a,b]=await Promise.all([searchSource(source,'甲'),searchSource(source,'乙')]);
  expect(a[0].name).toBe('甲:书名');
  expect(b[0].name).toBe('乙:书名');
});

test('each result receives its own copy of search variables', async () => {
  const scripted={...source,ruleSearch:{bookList:'div.item',name:'@js:var old=java.get("seen"); java.put("seen",result.text()); old+":"+result.text();',author:'@js:java.get("seen")',bookUrl:'a@href'}};
  jest.spyOn(globalThis,'fetch').mockResolvedValue(response('<div class="item"><a href="/1">甲</a></div><div class="item"><a href="/2">乙</a></div>',source.bookSourceUrl+'/search') as unknown as Response);
  const books=await searchSource(scripted,'关键字');
  expect(books.map(book=>[book.name,book.author,JSON.parse(book.variable!).seen])).toEqual([[':甲','甲','甲'],[':乙','乙','乙']]);
});
