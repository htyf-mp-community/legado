jest.mock('../src/data/storage',()=>({appStorage:{getString:jest.fn(),set:jest.fn(),remove:jest.fn()}}));
jest.mock('../src/core/sourceRequest',()=>({buildSourceSearchRequest:jest.fn(async(_source,rule)=>({url:`https://example.com${rule}`})),buildSourcePageRequest:jest.fn((_source,url)=>({url})),executeSourceRequest:jest.fn()}));
import {executeSourceRequest} from '../src/core/sourceRequest';
import {searchSource,exploreSource,loadBookInfo,loadChapters} from '../src/core/webBook';
import {runSourceJavaScript} from '../src/core/sourceJavaScript';
import type {SourceRuleScriptTask} from '../src/core/sourceRule';
import type {BookSource} from '../src/types';
const request=executeSourceRequest as jest.MockedFunction<typeof executeSourceRequest>;
const source:BookSource={bookSourceUrl:'https://example.com',bookSourceName:'测试',bookSourceType:0,customOrder:0,enabled:true,enabledExplore:true,searchUrl:'/search',ruleSearch:{bookList:'@js:java.put("scope","列表");result.items',name:'@js:java.put("id",result.id);result.name+java.get("scope")',bookUrl:'@js:"/book/"+java.get("id")',author:'$.author',kind:'@js:result.kind'},ruleExplore:{bookList:'@js:result.items',name:'@js:result.name',bookUrl:'@js:"/book/"+result.id'},ruleBookInfo:{name:'@js:result.name',author:'@js:result.author',tocUrl:'@js:baseUrl'},ruleToc:{chapterList:'$.chapters[*]',chapterName:'$.name',chapterUrl:'$.url'}};
const runner=()=>jest.fn(async(task:SourceRuleScriptTask)=>{await Promise.resolve();return runSourceJavaScript(task.script,task.input,task.globals,task.lookup,task.variables,task.variableContext);});
beforeEach(()=>request.mockReset());
test('search and explore extract list scripts with isolated item variables',async()=>{
 request.mockResolvedValue({url:'https://example.com/search',data:{items:[{id:'1',name:'甲',kind:'玄幻'},{id:'2',name:'乙',kind:'科幻'}]}});
 const run=runner(),books=await searchSource(source,'书',1,undefined,{runRuleJavaScript:run});
 expect(books.map(x=>[x.name,x.bookUrl,x.kind,JSON.parse(x.variable!).id])).toEqual([['甲列表','https://example.com/book/1','玄幻','1'],['乙列表','https://example.com/book/2','科幻','2']]);
 const explored=await exploreSource(source,{title:'发现',url:'/explore'},1,{runRuleJavaScript:run});expect(explored.map(x=>x.name)).toEqual(['甲','乙']);expect(run).toHaveBeenCalled();
});
test('search redirects to detail scripts and retains the page for subsequent detail and catalogue calls',async()=>{
 const direct={...source,bookUrlPattern:'https://example\\.com/book/\\d+'};request.mockResolvedValue({url:'https://example.com/book/1',data:{name:'直达书',author:'作者',chapters:[{name:'第一章',url:'/1'}]}});
 const run=runner(),[book]=await searchSource(direct,'书',1,undefined,{runRuleJavaScript:run});expect(book.name).toBe('直达书');expect(run.mock.calls.some(([task])=>task.script==='result.name')).toBe(true);
 const info=await loadBookInfo(direct,book,undefined,{runRuleJavaScript:run});expect((await loadChapters(direct,info)).map(x=>x.title)).toEqual(['第一章']);expect(request).toHaveBeenCalledTimes(1);
});
test('search extraction cancellation stops later fields',async()=>{
 request.mockResolvedValue({url:'https://example.com/search',data:{items:[{id:'1',name:'甲'}]}});const controller=new AbortController();
 const run=jest.fn(async(task:SourceRuleScriptTask)=>{if(task.script.includes('java.put("id"'))controller.abort();return runSourceJavaScript(task.script,task.input,task.globals,task.lookup,task.variables,task.variableContext);});
 await expect(searchSource(source,'书',1,controller.signal,{runRuleJavaScript:run})).rejects.toMatchObject({name:'AbortError'});expect(run.mock.calls.some(([task])=>task.script.includes('"/book/"'))).toBe(false);
});
